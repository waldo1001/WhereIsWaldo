# Implementation handoff — current status & next tasks

> **For the next session picking this repo up: read this file, then `CLAUDE.md`, then the spec your task references. Everything you need is written down; if you find ambiguity, fix the spec first (specs/README.md).**

## Status (2026-07-19)

| Area | State |
|---|---|
| Specs 000/001/002 | ✅ Complete and normative (product, full API contract, storage schema) |
| Repo scaffold, CI workflows | ✅ In place; `backend` workflow gates test + mutation, deploy auto-skips until Azure exists |
| Backend | ⬜ **Config only — zero implementation code.** `src/index.ts` is a tsc placeholder. **This is deliberately unimplemented: TDD from the first line is the process.** |
| Android / iOS / web | ⬜ Not started (placeholder READMEs describe the planned shape) |
| Azure/Firebase provisioning | ⬜ Manual, human-run: `docs/azure-setup.md` |

## Task B1 (next): backend — family creation & device registration, strict TDD

Scope: specs/001 §3.1 (create family) + §4.1 (register device) **only** — the rest of §3 (invites/members, §3.2–3.6) belongs to B3 — plus the http plumbing these two need (§1.3 envelopes, §1.5 auth guard). Everything else stays unimplemented.

1. **Scaffold the source layout** described in `backend/README.md`: `src/{functions,http,domain,ports}` + `test/{fakes,unit}`. Define the ports first (`src/ports/`): repositories, `TokenVerifier`, `Clock`, `IdGenerator` — interfaces only. Pinned contract: `IdGenerator.next(length)` returns `length` chars of `[A-Za-z0-9]`; **domain code** adds the `fam_`/`lr_` prefix; the `SeqIdGenerator` fake pads its sequence to `length` deterministically. Delete `src/index.ts` once real sources exist.
2. **RED — write these failing tests and run them (`npm run test:watch`); confirm every one fails before implementing:**
   - `test/unit/domain/createFamily.test.ts`
     1. creates family with given name; creator becomes role `parent`
     2. generates `fam_` + 20 `[A-Za-z0-9]` id via the `IdGenerator` port (assert format)
     3. writes the `Users` profile row (uid → familyId, role) via repo fake
     4. creates `Entitlements` with `subscriptionStatus: "free"`
     5. returned features === derivation from `PLAN_MATRIX.free`
     6. `FAMILY_ALREADY_MEMBER` when uid already has a family
     7. `VALIDATION_FAILED` for empty name / name > 50 chars / missing displayName
     8. records usage metric `apiCalls`
   - `test/unit/domain/registerDevice.test.ts`
     1. first registration applies defaults: `syncIntervalMinutes: 15`, `trackingEnabled: true`, `deviceName` = `model` when omitted
     2. upsert of existing deviceId updates `pushToken`/`appVersion`/`model`/`platform`, **preserves** interval/paused/deviceName
     3. `FAMILY_NOT_FOUND` when caller has no family
     4. `VALIDATION_FAILED` for platform ∉ {android, ios} and non-UUID deviceId
     5. registration without `pushToken` is accepted (token is optional, §4.1)
     6. `VALIDATION_FAILED` with `details.reason: "deviceIdInUse"` when the deviceId belongs to another user (§1.4)
     7. `LIMIT_EXCEEDED` with `details.limit: "maxDevices"` at the plan cap (count from device repo fake)
     8. upsert never counts against the cap (2 ∩ 7)
   - `test/unit/http/authGuard.test.ts` — missing header → `AUTH_MISSING_TOKEN`; verifier throws → `AUTH_INVALID_TOKEN`; expired → `AUTH_TOKEN_EXPIRED`; happy path yields `{uid, familyId, role}`; no-profile allowance for the two §1.5.3 endpoints
   - `test/unit/http/envelope.test.ts` — `ok()` always embeds `features`; `fail()` matches §1.3 with `requestId`; error codes only from the §10 catalog
3. **GREEN:** minimal `src/domain/family/createFamily.ts`, `src/domain/device/registerDevice.ts`, `src/domain/plan.ts` (PLAN_MATRIX), `src/http/{envelope,errors,authGuard,validate}.ts` + `test/fakes/` in-memory ports. No Azure imports anywhere in these paths.
4. **REFACTOR**, then run `npm run mutation` — must pass `break: 60`. Kill surviving mutants with tests, don't lower the threshold.
5. **Wire the edge (thin):** `src/functions/{families,devices}.functions.ts` (v4 `app.http`, routes `v1/families`, `v1/devices`) + the five small table adapters (`Families`, `Users`, `Devices`, `Entitlements`, `Usage` — specs/002 §2; `Usage` is required because §3.1 records `apiCalls`) + `src/adapters/auth/firebaseJoseVerifier.ts` (specs/001 §2.2, incl. `AUTH_MODE=insecure-local` guard §2.3). Adapters get no unit tests (integration later); functions stay logic-free.
6. **Verify:** `npm test` green, `npm run mutation` green, `npm run build` clean. Optional smoke: `npm run dev:storage` + `npm run dev`, then `POST /api/v1/families` with an unsigned JWT → 201 envelope.
7. **Review gate (mandatory):** code review (spec conformance + TDD evidence) **and** security review per [docs/security-review-checklist.md](security-review-checklist.md); fix all findings. `/dev-loop` runs this gate automatically; a manual session must run it explicitly before committing.
8. Commit(s) referencing the spec, e.g. `backend: create family + register device (specs/001 §3.1, §4.1)`.

**Definition of done:** every §11-checklist item touching create-family/register-device is covered; red was observed before green; mutation gate passes; the code + security review gate passed; nothing outside B1 scope got implemented.

## Backlog (single source of truth for `/dev-loop` — keep the format machine-parseable)

Status values: `todo` | `in-progress` | `review` | `done` | `blocked` | `human` | `failed`. A task is **runnable** when its status is `todo` and every ID in *Depends on* has status `done`. `human` tasks are performed by the user; only the user may flip them to `done`.

| ID | Scope | Depends on | Status |
|---|---|---|---|
| B1 | Create family + register device + http plumbing (001 §3.1, §4.1; detailed checklist above) | — | todo |
| B2 | Locations: report batch §5.1 + latest §5.2 (idempotency markers, last-known only-newer, piggyback) | B1 | todo |
| B3 | Invites & members §3.2–3.6 | B1 | todo |
| B4 | Locate flow §6 + FCM adapter §8 | B2 | todo |
| B5 | Geofences §7 (config ETag flow, events, flag-filtered fan-out) | B2, B4 | todo |
| B6 | History §5.3/§7.4 (blob store + cursor) + storage-adapter integration tests vs Azurite (002 §6) | B2 | todo |
| H1 | Run `docs/azure-setup.md` (Azure + Firebase + branch protection) | — | human |
| A1 | Android: write `003-android-client.md` spec **first**, then app skeleton + auth + device registration slice | B1, H1 | todo |
| I1 | iOS: write `004-ios-client.md` spec first, same slice; **file the Location Push entitlement application on day one** | B1, H1 | todo |

**Working the backlog:** invoke **`/dev-loop`** (skill in `.claude/skills/dev-loop/`) — e.g. `/dev-loop parallel 3` runs up to 3 dependency-safe coding agents concurrently in isolated worktrees; every task passes a **code review + security review gate** ([docs/security-review-checklist.md](security-review-checklist.md)) before it may merge. Manual sessions implementing a task directly MUST run the same gate before committing to main.

## Dev-loop log

*(appended by /dev-loop — newest first: date · task · agent rounds · review findings fixed · merge commit)*

Keep this file updated at the end of every session (status table, backlog statuses, log).
