# 000 — Where's waldo: product overview (canonical)

## Goal

A private, family-only location tracking app ("Find My Family" style) for **Android phones/tablets and iOS iPhones/iPads**. Laptops and other devices are explicitly out of scope for v1. Open system within the family: everybody sees everything. Cheap to run (a few euros/month on Azure) and battery-efficient — battery consumption is a **hard requirement**, not a nice-to-have.

## Core functionality

1. **Live location map** — every family member sees every other member's last-known location on a map. Staleness is surfaced (`isStale`, see 001 §5.2) so the UI can distinguish "here now" from "here two hours ago".
2. **Periodic background sync** — each device reports its location on a per-device configurable interval: **5, 10, 15, 30 minutes, 1 hour, 2 hours, or 1 day**. Interval tuning exists to trade freshness for battery. Devices batch offline fixes and upload when connectivity returns (001 §5.1).
3. **On-demand live location ("push-to-locate")** — any member requests another member's current position; the backend pushes a high-priority wake to the target device, which takes a brief high-accuracy foreground GPS fix and reports back immediately. This **always overrules the configured interval**. The requester sees last-known instantly while the fresh fix happens in parallel (001 §6).
4. **Historical tracking** — every location report and geofence event is stored and replayable on a map (trail + timeline) via paginated history APIs (001 §5.3, §7.4).
5. **Geofencing with notifications** — predefined places (home, school, work, …). Geofences are evaluated **natively on-device** (platform geofencing APIs — battery-efficient). On enter/exit the device reports the event; the backend stores it as history and pushes a notification to all family devices except the reporting device (001 §7.3) — e.g. "Noor arrived at Home". Geofence definitions are managed centrally (JSON config, synced to devices with ETags — no app update needed to change them) (001 §7).
6. **Temporary groups** — a temporary community "find me" (005): any user creates a group with an end date (festival, holiday), shares a multi-use join code, and all members see each other's **live position only** (no history, no battery/device detail) until the group ends; expiry behavior is a per-group choice (delete / grace / archive) and expired location data is **physically deleted** (001 §12, 002 §2.10–2.13).

## Roles & family model

- **Parents** (one or more) = admins: create the family, invite parents or kids (invite code; email delivery of invites is an open item), manage geofences, manage per-device settings, and can **enable/disable tracking per device** without removing the member (a "pause" button).
- **Members** (kids): see everyone's location; cannot change settings.
- **Devices:** each user can have multiple devices (phone, tablet). Each device has its own client-generated ID, its own sync interval, and its own tracking on/off flag. Devices belong to the **user** (002 §2.4) — a family is not required to register one.
- One family per user (v1). Removing a member deletes their membership, not their historical data (retention handles that).
- **Groups (temporary, 005)** are independent of families: membership is per-user (owner + members), a user has at most one family plus up to `maxActiveGroups` groups — or **no family at all** (family-less users are first-class: profile without family, 001 §1.5). Each membership carries its own per-group `displayName`. Family features (family map, history, geofences, locate, pause administration) require a family; groups only require an account.

## Architecture (fixed — changes require a spec PR and explicit approval)

| Concern | Choice |
|---|---|
| Backend | Azure Functions, **consumption plan**, HTTP-triggered, **TypeScript / Node 20, v4 programming model** |
| Storage | Azure **Blob Storage** (JSONL history per family/member/date, append blobs) + Azure **Table Storage** (point lookups: last-known, roster, devices, entitlements). **No database server.** |
| Push | **FCM HTTP v1 as the single push API** for both platforms (FCM routes to APNs for iOS). Sole planned exception: iOS Location Pushes go direct to APNs once the O1 entitlement lands — FCM cannot address location push tokens (001 §8.1). |
| User auth | **Firebase Auth — phone-number-only sign-in** (SMS OTP, 006); backend verifies Firebase ID tokens statelessly via Google JWKS (001 §2) |
| Azure auth | Managed identity everywhere; no credentials in code. (Exception, flagged: FCM sending needs a Google service-account key in Function App settings — Google-side constraint; WIF hardening is an open item.) |
| Web viz | Optional, later: Leaflet on Azure Static Web Apps free tier |
| Distribution | Google Play + Apple App Store (full publishing, not TestFlight-only) |
| CI/CD | GitHub Actions; tests + StrykerJS mutation gate; deploy to Azure via OIDC federated credentials (no publish-profile secrets) |

## Decisions log

| # | Decision | Rationale |
|---|---|---|
| D1 | Backend in TypeScript/Node (over C#/Python) | Fast consumption-plan cold starts, first-class StrykerJS+Vitest mutation tooling, same language as future web viz |
| D2 | Native Kotlin + Swift (over Flutter/RN) | Direct platform geofencing + background-scheduling APIs; battery is a hard requirement; matches parallel-session repo layout |
| D3 | Firebase Auth (over custom tokens / Entra External ID) | Free at family scale, both platforms, no hand-rolled crypto, pairs with FCM already in the stack |
| D4 | Push-to-locate: requester **polls** (no push-back to requester) | Requester is foregrounded watching the map; polling avoids a second push-delivery failure domain |
| D5 | Geofence config = single JSON document with ETag (no per-fence CRUD) | Devices need the whole set to re-register platform geofences; ETag gives free 304s + lost-update protection |
| D6 | History = append blobs, JSON lines, one blob per device-day | `AppendBlock` is atomic (no lease/ETag loops under concurrent Functions); capacity/cost headroom is enormous |
| D7 | Location report idempotency at **batch** level | Retries resend whole batches; per-fix markers would cost N table writes for no added safety |
| D8 | `LIMIT_EXCEEDED` is HTTP **402** | Single upsell hook for the future subscription tier |
| D9 | Firebase token verification without Admin SDK (jose + JWKS) | No Google credential needed for auth; revocation gap accepted — see 001 §2.4 |
| D10 | Phone-number-only sign-in via Firebase Phone Auth, replacing email/password (006) | The phone is the natural identity (WhatsApp model); no passwords for kids to manage; server contract untouched (provider-invisible tokens); Blaze + per-SMS billing accepted at cents/month, guarded by region allowlist + budget alert; pre-launch, so a one-time account reset instead of migration |
| D11 | Groups independent of families; profile decoupled from family (`familyId` nullable), `Devices`/`LastKnown` re-keyed per-user (005, 001 §1.5, 002 §2.2/2.4/2.5) | A festival crew isn't a family; family-less users must be first-class or every invitee needs a fake family. Re-keying devices per owner makes ownership structural and family optional — free to do pre-launch (no data to migrate), poisonous to retrofit later. Pseudo-family alternative rejected: it corrupts `Entitlements` and `FAMILY_ALREADY_MEMBER` semantics |
| D12 | Group live positions = fan-out-on-write to a per-group partition (`GroupLastKnown`, 002 §2.12) | Map reads dominate ingest (polling foreground map vs ≥5-min batches), so pay ≤`maxActiveGroups` extra guarded writes per batch to keep every read one partition scan (002's standing rule). Privacy bonus: group location data lives only in the group's own partition — deletion is a self-contained partition wipe |
| D13 | Group lifecycle = derived state (`f(now, endsAt, policy)`) + lazy read enforcement + a daily sweeper for physical deletion (005 §2, 002 §4.1) | No stored state machine → no transition writes, no drift; matches the existing lazy-expiry idiom (invites, locate requests). Table Storage has no row TTL and "temporary" must mean *actually deleted*, so the sweeper — the project's first timer function — does the physical purge, found via a date-bucket index, never a full scan |
| D14 | Groups are live-only and position-only: no group history/geofences/locate, no battery/device detail on the group map (005 §3/§5) | Group members may be strangers to each other: durable movement records, on-demand device waking, and battery/device detail cross the trust line families have and groups don't — and every byte not stored is a byte the deletion promise doesn't have to cover |

## Subscription-ready (NOT implemented)

The app is free and family-only. The architecture must make a future subscription trivial:

- Every family has an entitlements record: `subscriptionStatus: "free" | "active"`, default `"free"` (002 §2).
- Every **success response with a body** includes a `features` object (limits + flags) derived server-side from `PLAN_MATRIX[subscriptionStatus]` — clients adapt without code changes (001 §9; body-less exceptions: the `204`s of 001 §3.6/§12.5/§12.8/§12.9 and the `304` of 001 §7.1).
- Every limit enforcement point reads the features object, never a literal.
- Backend logs usage per family/day (002 §2, `Usage` table).
- **No StoreKit / Play Billing code** until a numbered subscriptions spec exists.

## Development process

See [`specs/README.md`](README.md). Summary: spec-driven (no code before spec), strict TDD (red → green → refactor), StrykerJS mutation gate in CI, parallel per-area sessions coordinating only via specs. Every PR references its spec.

## Open items

| # | Item | Notes / owner |
|---|---|---|
| O1 | **iOS push-to-locate reliability** | Silent pushes (`content-available: 1`) are budgeted/coalesced by iOS — not a reliable wake. The correct mechanism is the **Location Push Service Extension** (`com.apple.developer.location.push`, `apns-push-type: location`), built for exactly this use case but requiring an application to Apple. Payloads are designed for both (001 §8); ship best-effort fallback + "last known, updating…" UX; **apply for the entitlement immediately**. Once granted, locate pushes go **direct to APNs** (location push token from `startMonitoringLocationPushes`, topic `<bundleId>.location-query` — FCM cannot address location push tokens), which adds an APNs `.p8` key credential to the backend (001 §8.1; device registers `locationPushToken` per 001 §4.1). iOS session must also spec the "Always" location permission onboarding dance. |
| O2 | **Sub-15-min sync intervals (both platforms)** | Android: WorkManager's periodic floor is 15 min — 5/10-min intervals require a foreground service with a persistent notification (Play-policy compliant for family tracking) + `ACCESS_BACKGROUND_LOCATION` review prep; ≥15 min uses WorkManager. iOS: sub-15-min cadences are **not reliably achievable** with background scheduling — the interval is a target, delivery is opportunistic, and such devices will often show `isStale: true` (001 §5.2). |
| O3 | **"1 day" interval semantics** | Defined as: at least one fix per **device-local calendar day**, taken opportunistically (first unlock/network of the day) — NOT "every 24 h since last fix" (drift makes that useless). Normative for clients. |
| O4 | **FCM token rotation** | Clients MUST re-`POST /devices` on token refresh. Backend prunes tokens FCM reports `UNREGISTERED` (device marked `pushInvalid`, surfaced to parents) (001 §4.1). |
| O5 | **Email delivery of invites** | v1 = invite code shared via OS share sheet; `emailHint` recorded only. ACS email = later spec. |
| O6 | **FCM credential** | Google-side constraint: HTTP v1 send needs a service-account key (Function App setting). Backlog: GCP Workload Identity Federation trust to the Azure managed identity → zero stored keys. |
| O7 | **Privacy / GDPR** | Children's location data, EU users: family-delete + per-member data-export endpoints need a numbered spec **before any public release**. Retention policy (002 §4) is the first step. |
| O8 | **Notification localization** | v1 pushes carry server-composed English text plus structured data; clients MAY re-render locally. Proper i18n later. |
| O9 | **Geofences above 20** | iOS caps monitored regions at 20/app — hence `maxGeofences: 20`. A paid tier above 20 would need client-side nearest-region rotation. |
| O10 | **Trademark** | "Where's Waldo/Wally" is the book franchise's mark. Fine private; revisit before public store branding. |
| O11 | **Phone-number surfacing** | The ID token's `phone_number` claim is deliberately unused in v1 (006 §2). Showing numbers on rosters later is additive (`VerifiedToken` gains an optional field) but is a children's-PII decision — bundle with O7. |
| O12 | **Number change / account linking** | v1: a changed phone number = a new account, re-invite to family/groups (006 §1). If that ever hurts, an account-linking flow (verify old + new number, remap or re-key) needs its own numbered spec. |
| O13 | **Per-group sharing pause** | v1: `trackingEnabled` is device-global (a paused device reports nowhere); "stop sharing with this group" = leave and rejoin later (005 §3). A per-(device, group) pause would need its own settings rows + piggyback changes — spec it only if leaving proves too blunt. |
| O14 | **Group push notifications** | `GROUP_MEMBER_JOINED` / `GROUP_ENDING_SOON` `data.type` values are reserved (001 §8.7), not sent. The sweeper's daily run is the natural `GROUP_ENDING_SOON` emitter when this lands; FCM client handling is still stubbed on both platforms anyway. |
| O15 | **Group ownership transfer** | v1: none — the owner cannot leave (`ownerCannotLeave`, 001 §12.8); they end or delete the group instead. Transfer (pick a successor, owner leaves) is additive if wanted. |
| O16 | **HTTPS universal join links** | v1 ships the in-app deep link (`waldo://group-join?code=…`, 003/004). Web-hosted `https://` links that work without the app installed belong to the future web spec (App Links / Universal Links + a landing page). |

## Test checklist

Covered by the per-area specs (001 §11, 002 §6); this overview has no directly testable surface.

## Open questions

None — unresolved matters are tracked as Open Items above with explicit v1 behavior.
