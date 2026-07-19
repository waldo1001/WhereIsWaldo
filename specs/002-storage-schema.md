# 002 — Storage schema

## Goal

The complete, normative storage design: one Azure Storage account, Table Storage for point lookups, Blob Storage for history and config. No database server (000 §Architecture). Every access pattern is a point read or a single-partition scan — no cross-partition queries exist. Wire shapes referenced here are defined only in [001](001-api-contract.md).

## 1. Account & access

- One storage account (e.g. `stwhereswaldo`, see `docs/azure-setup.md`).
- The Function App's **system-assigned managed identity** holds `Storage Table Data Contributor` + `Storage Blob Data Contributor` on the account. No connection strings/keys in code or settings (except local Azurite).
- Local dev: Azurite; endpoints via `TABLES_ENDPOINT` / `BLOB_ENDPOINT` app settings (see `backend/local.settings.json.example`). Adapters MUST select credentials by endpoint host: `AzureNamedKeyCredential` with the well-known `devstoreaccount1` name/key when the host is `127.0.0.1`/`localhost`, `DefaultAzureCredential` otherwise.

## 2. Table Storage

General rules:

- All timestamps stored as ISO 8601 UTC strings (matching 001 §1.4), not Ticks.
- RowKey prefixes (`member:`, `device:`, …) keep entity kinds range-scannable within one partition.
- "Conditional insert" = `Add` (fails `409` if exists); "guarded update" = ETag-conditional `Update/Merge`.

### 2.1 `Families`

| PK | RK | Properties |
|---|---|---|
| `{familyId}` | `meta` | `familyName`, `createdBy` (userId), `createdAt` |
| `{familyId}` | `member:{userId}` | `role` (`parent`\|`member`), `displayName`, `joinedAt` |

Access: point read (`meta`); partition range scan on `member:` = roster (001 §3.2). Roster mutations are guarded updates (last-parent rule checked inside the scan, 001 §3.5/3.6).

### 2.2 `Users` — the auth hot path

| PK | RK | Properties |
|---|---|---|
| `{userId}` | `profile` | `familyId`, `role` (denormalized), `displayName` |

Every authenticated request does exactly one point read here (001 §1.5). `role` is denormalized from `Families`; both rows are written in the same logical operation on role change (no distributed transaction — `Families` is the source of truth, `Users` a cache; on mismatch the request re-reads `Families`).

### 2.3 `Invites`

| PK | RK | Properties |
|---|---|---|
| `{inviteCode}` (canonical uppercase, no hyphen) | `invite` | `familyId`, `role`, `emailHint?`, `createdBy`, `createdAt`, `expiresAt`, `usedBy?`, `usedAt?` |

Accept flow (001 §3.4): point read → validate → **ETag-guarded merge** setting `usedBy`/`usedAt`. Exactly one concurrent accept wins; the loser sees a precondition failure → `INVITE_ALREADY_USED`.

### 2.4 `Devices`

| PK | RK | Properties |
|---|---|---|
| `{familyId}` | `device:{deviceId}` | `ownerUserId`, `platform`, `model`, `appVersion`, `deviceName`, `pushToken`, `pushInvalid` (bool), `syncIntervalMinutes`, `trackingEnabled`, `registeredAt`, `lastSeenAt` |

Partition scan = all family devices: the 001 §4.2 listing, the push fan-out list (001 §8.2/8.4), and the device-cap count (001 §4.1). `lastSeenAt` is updated at most once per minute per device (write-skipping to save transactions).

### 2.5 `LastKnown`

| PK | RK | Properties |
|---|---|---|
| `{familyId}` | `device:{deviceId}` | `lat`, `lon`, `accuracyM`, `altitudeM?`, `speedMps?`, `bearingDeg?`, `batteryPct`, `recordedAt`, `receivedAt`, `source` |

Live map (001 §5.2) = one partition scan joined in memory with `Devices` and the `Families` `member:` roster (for `displayName`/`ownerDisplayName`) — three single-partition scans are the entire read cost of the map. Upsert rule: overwrite only if incoming `recordedAt` > stored `recordedAt` (guarded update with one retry on ETag race; second loss = skip, the other writer was newer).

### 2.6 `Entitlements`

| PK | RK | Properties |
|---|---|---|
| `{familyId}` | `entitlement` | `subscriptionStatus` (`free`\|`active`), `updatedAt` |

Created at family creation with `free` (001 §3.1). Read per request (cache per invocation). The `features` object is **always** computed from `PLAN_MATRIX[subscriptionStatus]` in domain code — never stored.

### 2.7 `LocateRequests`

| PK | RK | Properties |
|---|---|---|
| `{familyId}` | `req:{requestId}` | `targetUserId`, `targetDeviceId`, `requestedBy`, `status` (`pending`\|`fulfilled`\|`expired`\|`pushFailed`), `createdAt`, `expiresAt`, `fixJson?` |

Point read on poll (001 §6.2). Lazy expiry: a poll past `expiresAt` flips `pending → expired` in place. Coalescing (001 §6.1): partition scan filtered to `pending` + same `targetDeviceId` (tiny partitions — a family has at most a handful of rows here). Old rows are garbage — a cleanup timer function is a backlog item, not v1.

### 2.8 `IdempotencyMarkers`

| PK | RK | Properties |
|---|---|---|
| `{deviceId}` | `batch:{batchId}` | `receivedAt`, `fixCount` |
| `{deviceId}` | `event:{eventId}` | `receivedAt` |
| `{deviceId}` | `fix:{fixId}` | `receivedAt` (locate fulfills only, 001 §6.3) |

Conditional insert = the dedupe test (001 §5.1, §7.3; decision 000 §D7). Rows are tiny; purge timer = backlog item.

### 2.9 `Usage`

| PK | RK | Properties |
|---|---|---|
| `{familyId}` | `{yyyy-MM-dd}:{metric}` | `count` (Int32) |

Metrics: `locationBatches`, `fixes`, `locateRequests`, `geofenceEvents`, `apiCalls`. Increment = read → +n → ETag-guarded merge, retry loop (max 3, then log-and-drop — usage is telemetry, not billing… yet). Contention is a single family's own devices: single-digit writes/minute worst case. The locate quota (001 §6.1) reads `{today}:locateRequests`.

## 3. Blob Storage

### 3.1 Containers & paths

| Container | Path | Blob type | Content |
|---|---|---|---|
| `history` | `{familyId}/{userId}/{deviceId}/{yyyy}/{MM}/{dd}.jsonl` | **Append blob** | One JSON line per location fix |
| `events` | `{familyId}/{yyyy}/{MM}/{dd}.jsonl` | **Append blob** | One JSON line per geofence event (all members interleaved; filter at read) |
| `config` | `{familyId}/geofences.json` | Block blob | The geofence document (001 §7.1); **the blob's ETag is the API ETag** |

Day boundaries are **UTC dates of `recordedAt`** (not `receivedAt` — a batch uploaded at 00:05 lands in the day the fixes happened; one batch may append to two day-blobs).

### 3.2 Append semantics (000 §D6)

- Writer: `AppendBlock` per day-group of a batch; create-if-not-exists first (`If-None-Match: *`, swallow `409`).
- `AppendBlock` is atomic per call → concurrent Function instances interleave safely with **no lease, no ETag loop**. Lines may be out of order across blocks; readers sort by `recordedAt`.
- Capacity: 50 000 blocks/blob vs ≤ 288 appends/device-day at the tightest interval — 170× headroom even if every fix were its own block.
- History line (fix): `{"fixId":"…","recordedAt":"…","receivedAt":"…","lat":…,"lon":…,"accuracyM":…,"altitudeM":…,"speedMps":…,"bearingDeg":…,"batteryPct":…,"source":"periodic"}` — optional fields omitted, not null.
- Event line: `{"eventId":"…","userId":"…","deviceId":"…","geofenceId":"…","geofenceName":"Home"|null,"lat":51.0543|null,"lon":3.7174|null,"radiusM":150|null,"transition":"enter","recordedAt":"…","receivedAt":"…"}` — `geofenceName`, `lat`, `lon`, `radiusM` are frozen at write time so moving/renaming/deleting a geofence never rewrites history and events stay plottable (001 §7.4); all four are `null` when the `geofenceId` was unknown at write time.

### 3.3 History read & cursor (001 §5.3, §7.4)

- Reader walks day blobs ascending from `from` to `to`, streaming lines, filtering (`deviceId`, `userId`), sorting per day by `recordedAt`, until `limit` is filled.
- Cursor: base64url JSON — `{"d":"2026-07-05","o":{"<deviceId>":12800}}` — resume date + per-device-blob byte offset (events: single `"o":12800`). Opaque to clients; format may change without notice.
- Duplicate `fixId`s within a day (crash-retry edge) are dropped at read time (last write wins by `receivedAt`).

### 3.4 Geofence config concurrency (001 §7.2)

`PUT` = upload with `If-Match: <etag>` (or `If-None-Match: *` for the `"0"` sentinel first write). Storage's `412` maps to `409 GEOFENCE_VERSION_CONFLICT`. `version` lives inside the JSON and increments on every successful PUT; the ETag is the concurrency token, `version` is the human-readable one.

## 4. Retention & lifecycle

Lifecycle management policy on the account (applied by `docs/azure-setup.md`; JSON below is normative):

```json
{ "rules": [ {
    "name": "history-retention",
    "enabled": true,
    "type": "Lifecycle",
    "definition": {
      "filters": { "blobTypes": ["appendBlob"], "prefixMatch": ["history/", "events/"] },
      "actions": { "baseBlob": {
        "delete": { "daysAfterModificationGreaterThan": 400 } } } } } ] }
```

- Physical retention: delete at 400 d. Azure lifecycle management supports **only the delete action for append blobs** (no `tierToCool`) — history blobs stay in the hot tier until deletion, which at ~15 MB/year is cost-irrelevant.
- The **free-tier read window** (`features.limits.historyDays: 90`) is enforced in the API (001 §5.3), *not* by lifecycle — upgrading a family to a longer window later requires zero data migration (data exists to 400 d regardless).
- Tables (`LastKnown`, markers, usage) are small; no lifecycle needed. Marker/locate-request purge timers = backlog.
- GDPR delete/export (000 §O7) will operate on the `{familyId}/…` prefixes — the path design makes per-family and per-user erasure a prefix delete.

## 5. Cost model (order of magnitude)

Family of 5, 15-min intervals: ~480 fixes/day ≈ 480 appends + ~500 table transactions/day ≈ **well under €1/month** in transactions; storage ~15 MB/year of JSONL. The dominant cost is Functions consumption executions, still single-digit euros. Fits the 000 cost target with a wide margin.

## 6. Test checklist (storage adapters — integration tests, later session)

- Guarded-update races: invite single-use, last-known only-newer, usage increment retry.
- Append interleaving: two concurrent batch writers to the same day blob both land; reader sorts correctly.
- Batch spanning midnight UTC splits across two day blobs.
- Cursor round-trip across day boundaries and multi-device merge.
- Geofence ETag flow incl. `"0"` sentinel create and 412→409 mapping.
- Unit tests (domain) MUST NOT touch any of this — fakes implement the ports (`backend/src/ports/`).

## Open questions

None — purge timers and GDPR endpoints are tracked in 000 §Open Items (O7) / backlog notes above.
