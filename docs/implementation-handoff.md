# Implementation handoff — current status & next tasks

> **For the next session picking this repo up: read this file, then `CLAUDE.md`, then the spec your task references. Everything you need is written down; if you find ambiguity, fix the spec first (specs/README.md).**

## Status (2026-07-19)

| Area | State |
|---|---|
| Specs 000/001/002 | ✅ Complete and normative (product, full API contract, storage schema) |
| Repo scaffold, CI workflows | ✅ In place; `backend` workflow gates test + mutation, deploy auto-skips until Azure exists |
| Backend | 🔵 **B1+B2 merged** (family+device+http plumbing; locations report+live-map §5.1/§5.2). B3 in review; B4/B6 in progress. 89 tests, mutation 100%. |
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
| B1 | Create family + register device + http plumbing (001 §3.1, §4.1; detailed checklist above) | — | done |
| B2 | Locations: report batch §5.1 + latest §5.2 (idempotency markers, last-known only-newer, piggyback) | B1 | done |
| B3 | Invites & members §3.2–3.6 | B1 | done |
| B4 | Locate flow §6 + FCM adapter §8 | B2 | in-progress |
| B5 | Geofences §7 (config ETag flow, events, flag-filtered fan-out) | B2, B4 | todo |
| B6 | History §5.3/§7.4 (blob store read+cursor, completes B2's append-only historyBlobStore) + storage-adapter integration tests vs Azurite (002 §6) | B2 | in-progress |
| H1 | Run `docs/azure-setup.md` (Azure + Firebase + branch protection) | — | human |
| A1 | Android: write `003-android-client.md` spec **first**, then Compose foundation — **swappable design-system layer** (tokens→Material3 theme→stateless components, light+dark), full 001 API client, Firebase-Auth abstraction (stubbed), device registration §4.1, nav scaffold, one proof screen, JUnit logic tests | B1 (H1 waived for coding) | done |
| I1 | iOS: write `004-ios-client.md` spec first, then SwiftUI foundation — logic/design-system in a headless-testable **SPM package**, **swappable design-system layer** (tokens→theme→components, light+dark), full 001 API client, Firebase-Auth abstraction (stubbed), device registration §4.1, nav scaffold, one proof screen, `swift test` logic tests; **flag the Location Push entitlement application as a human/Apple task** | B1 (H1 waived for coding) | in-progress |
| A2 | Android feature screens on the design system: live map §5.2, history §5.3, geofences editor §7.1–7.2, locate-to-request §6, device/family settings §4.2–4.3/§3.5–3.6, invites §3.3–3.4 | A1 | todo |
| I2 | iOS feature screens on the design system: same inventory as A2 (§5.2, §5.3, §7.1–7.2, §6, §4.2–4.3/§3.5–3.6, §3.3–3.4) | I1 | todo |

**Mobile H1-waiver (user directive, 2026-07-19):** the mobile clients code against **specs/001 (complete, normative)**, not the backend implementation, so they run now with H1 (Azure/Firebase provisioning) still `human`/pending. All H1-dependent runtime bits — real `google-services.json`/`GoogleService-Info.plist`, live backend base URL, real Firebase project — are **stubbed behind interfaces and gitignored**; wire them for real when H1 is done. No secrets committed. **Final deliverable (do LAST, after coding is maximized):** a design-generation prompt (`docs/design-prompt.md`) targeting each app's documented design-token contract, so a design tool can produce the iOS + Android visual design that drops into the swappable layer.

**Working the backlog:** invoke **`/dev-loop`** (skill in `.claude/skills/dev-loop/`) — e.g. `/dev-loop parallel 3` runs up to 3 dependency-safe coding agents concurrently in isolated worktrees; every task passes a **code review + security review gate** ([docs/security-review-checklist.md](security-review-checklist.md)) before it may merge. Manual sessions implementing a task directly MUST run the same gate before committing to main.

## Dev-loop log

*(appended by /dev-loop — newest first: date · task · agent rounds · review findings fixed · merge commit)*

**Mobile CI-compile status (H1-waiver reality):** mobile code is merged **review-gated, not locally compile-verified** — Android has no Gradle/SDK in the build env (A1 is CI-compiled on the `android.yml` runner); iOS host has only Xcode CLT (no `Xcode.app`), so `WaldoKit` (SPM) `swift build`s green but the test *runtime* can't execute locally — the `ios.yml` `package` job runs real `swift test` on `macos-14`. Both apps' `.xcodeproj`/Gradle wrapper jar / real Firebase config are the first things to verify when H1 lands. This is expected per the "code now, CICD/smoketest later" directive.

**Known follow-ups / tech-debt (raised in review, deliberately deferred):**
- **`apiCalls` placement.** All domain use-cases increment `apiCalls` only on the success path (B1 pattern, mirrored by B2/B3), but §9 says "+1 per authenticated request, once auth succeeds." Since Usage is telemetry-not-billing (002 §2.9), deferred: move the `apiCalls` increment into the shared `authGuard`/HTTP layer so every authenticated request (incl. 4xx) counts exactly once — do it across B1+B2+B3 together, not piecemeal.
- **Catch-all error logging.** Function `errorResponse()` catch-alls log the raw `err` object. No demonstrated leak (Azure `RestError.request/response` are non-enumerable, so coordinates aren't serialized), but harden to log `err.message`/`err.code` only, across all `*.functions.ts`.

- **2026-07-19 · A1** · 2 rounds (initial + 1 fix) · reviews: code review **approved** (design-swappable seam verified — no hardcoded `Color/dp/sp` outside token dir; full 001 client; all 21 error codes mapped; scope=foundation only), security **approved** (no secrets/config tracked; **3 minor fixed** — cleartext carve-out scoped to `src/debug/` so release is TLS-only, CI `permissions: contents:read`, comment 20→21). Not locally compiled (no Android toolchain) — CI-compiled later. · merge `8bbf4eb`.
- **2026-07-19 · B3** · 2 coding rounds (initial + 1 fix) · reviews: code review **approved** (invite CSPRNG Crockford, race-safe single-use, last-parent protection, §3.6 device cleanup all verified); security found **1 minor fixed** — `userId` path param now zod-validated (rejects empty + Table-Storage-forbidden chars) so a bad key yields `VALIDATION_FAILED` not a masked `INTERNAL_ERROR`; 2 equivalent `refine`-message mutants accepted. Merged behind B2 with a trivial additive `validate.ts` conflict resolved by the orchestrator. Result: 153 tests, mutation 99.51% (break 60), build clean · merge `16115fc`.
- **2026-07-19 · B2** · 2 coding rounds (initial + 1 fix) · reviews: security **approved** clean; code review found **1 major fixed** — `details.fields` now uses bracket notation `fixes[3].recordedAt` (§5.1/§10) instead of dot, killing the deferred B1 `validate.ts` mutant with the correct format — **+1 minor fixed** (`lastKnownTableRepo` retry 2→1 per 002 §2.5); `apiCalls` note deferred to tech-debt above. Result: 89 tests, mutation 100% (365 mutants, break 60), build clean · merge `dad39f9`.

- **2026-07-19 · B1** · 2 coding rounds (initial + 1 fix) · reviews: code+security both ran; **1 finding fixed** — `firebaseJoseVerifier.ts` now enforces §2.2 "iat in the past" (jose omits it without `maxTokenAge`); **1 finding deferred to B2** — surviving `validate.ts` mutant (`.join(".")` vs `.join("")`), unobservable on B1's flat schemas, must be killed by a nested-path test in B2 batch validation · spec change: **specs/001 §4.1 pinned** (omitted token on update = preserve). Result: 46 tests, mutation 99.37% (break 60), build clean · merge `708a6fa`.

Keep this file updated at the end of every session (status table, backlog statuses, log).
