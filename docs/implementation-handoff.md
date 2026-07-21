# Implementation handoff — current status & next tasks

> **For the next session picking this repo up: read this file, then `CLAUDE.md`, then the spec your task references. Everything you need is written down; if you find ambiguity, fix the spec first (specs/README.md).**

## Status (2026-07-21)

| Area | State |
|---|---|
| Specs 000–006 | ✅ Complete and normative — product, full API contract, storage schema, both clients, **temporary groups (005)**, **phone-only auth (006)**. 001 error catalog is now 27 codes; new §12 group endpoints; 002 has 4 new group tables + the re-keyed `Devices`/`LastKnown`. |
| Repo scaffold, CI workflows | ✅ **All 3 pipelines green on `main`** — `backend` (test+mutation+deploy), `android`, `ios` (see H1 CI entry below) |
| Backend | ✅ B1–B6 merged & deployed (328 unit tests, mutation 99.61%, break 60, Azurite suite green, `func-whereiswaldo` via OIDC). 🟡 **New backlog from specs/005: B7–B12** (family-less profiles, per-user re-key, groups core/controls/locations, sweeper) — all `todo`. Phone auth (006) needs **zero** backend code. |
| Android / iOS | ✅ Foundation + all family feature screens merged (A1/A2, I1/I2; 108 + 126 tests CI-green). 🟡 **New backlog: A3/I3 (phone sign-in, 006) + A4–A5/I4–I5 (groups client + screens, 005)** — all `todo`. Note: A3/I3 **replace** the email/password sign-in that H1 added on Android (spec'd deletion, 003 §7). |
| web | ⬜ Not started (placeholder README) |
| Azure/Firebase provisioning | 🟡 Azure infra + OIDC CI/CD done; Firebase project exists (`whereiswaldo-30e9c`). **Remaining console/secret steps moved to H2** (phone-auth setup per `docs/azure-setup.md` §3: Blaze, Phone provider, SMS region allowlist, test numbers, App Check, APNs key, FCM key, account reset). |

## What's next (2026-07-21)

Specs 005 (temporary groups) + 006 (phone-only auth) are merged; the backlog below now has **12 coding tasks ready for `/dev-loop`** plus two human tasks:

1. **Code (dev-loop):** `/dev-loop parallel 3` — immediately runnable: B7, A3, I3, A4, I4 (specs are normative; H1/H2 waived for coding, same precedent as A1/I1). Then B8/B9 → B10/B11 → B12, and A5/I5 behind their platform deps.
2. **H2 (you, console/secrets):** Firebase phone-auth setup per `docs/azure-setup.md` §3 — Blaze + budget alert, Phone provider only, SMS region allowlist (BE/NL/FR/DE/LU), test phone numbers, App Check, APNs key, FCM service-account JSON, and the one-time account reset (006 §8). Coding doesn't block on this; **on-device sign-in and store builds do**.
3. **Smoke-test** the deployed backend once H2 is done (001 §11 smoke checklist; fresh-user happy sign is now `PROFILE_NOT_FOUND`).
4. Apply the **iOS Location Push entitlement** with Apple (000 §O1) — external lead time, apply early.
5. Create the iOS `.xcodeproj` app-target project (specs/004 §1.1) — only the thin app-shell project is still a structure-check stub in `ios.yml`.
6. Clear the **tech-debt** items listed under `## Dev-loop log` (apiCalls placement, error-log hardening, remaining integration tests).

The detailed original B1 checklist is preserved below for reference.

## Task B1 (DONE — original checklist, historical): backend — family creation & device registration, strict TDD

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
| B4 | Locate flow §6 + FCM adapter §8 | B2 | done |
| B5 | Geofences §7 (config ETag flow, events, flag-filtered fan-out) | B2, B4 | done |
| B6 | History §5.3/§7.4 (blob store read+cursor, completes B2's append-only historyBlobStore) + storage-adapter integration tests vs Azurite (002 §6) | B2 | done |
| H1 | Run `docs/azure-setup.md` (Azure + Firebase + branch protection). **Note (2026-07-21): the Firebase auth-provider portion is superseded by H2 (phone-only, specs/006); Azure/CI/branch-protection portions were done 2026-07-20.** | — | human |
| A1 | Android: write `003-android-client.md` spec **first**, then Compose foundation — **swappable design-system layer** (tokens→Material3 theme→stateless components, light+dark), full 001 API client, Firebase-Auth abstraction (stubbed), device registration §4.1, nav scaffold, one proof screen, JUnit logic tests | B1 (H1 waived for coding) | done |
| I1 | iOS: write `004-ios-client.md` spec first, then SwiftUI foundation — logic/design-system in a headless-testable **SPM package**, **swappable design-system layer** (tokens→theme→components, light+dark), full 001 API client, Firebase-Auth abstraction (stubbed), device registration §4.1, nav scaffold, one proof screen, `swift test` logic tests; **flag the Location Push entitlement application as a human/Apple task** | B1 (H1 waived for coding) | done |
| A2 | Android feature screens on the design system: live map §5.2, history §5.3, geofences editor §7.1–7.2, locate-to-request §6, device/family settings §4.2–4.3/§3.5–3.6, invites §3.3–3.4 | A1 | done |
| I2 | iOS feature screens on the design system: same inventory as A2 (§5.2, §5.3, §7.1–7.2, §6, §4.2–4.3/§3.5–3.6, §3.3–3.4) | I1 | done |
| H2 | Firebase console phone-auth setup per `docs/azure-setup.md` §3 (specs/006 §6/§8): Blaze + budget alert, enable Phone / all other providers off, SMS region allowlist BE+NL+FR+DE+LU, test phone numbers (console-only), App Check (Play Integrity + SHA-256s → refreshed `google-services.json`; App Attest), APNs key upload, `FCM_SERVICE_ACCOUNT_JSON`, one-time account reset (delete legacy users + wipe test storage) | — | human |
| A3 | Android phone sign-in (specs/006, 003 §7): new `AuthProvider` (`startPhoneVerification`/`confirmCode`), `FirebaseAuthProvider` rewrite + `CurrentActivityProvider`, phone-shaped `DevAuthProvider`, two-step `SignInStateHolder`/`SignInScreen`, `PhoneNumberNormalizer`, `PhoneAuthUserMessage`, **delete the email/password path**, full StateHolder-level tests (dev-mode complete without H2; on-device Firebase verification needs H2) | — | todo |
| I3 | iOS phone sign-in (specs/006, 004 §4): `AuthProviding` extension + `PhoneAuthError`, phone-shaped `StubAuthProvider` **+ real unsigned-JWT dev token fix**, two-step `SignInViewModel`/`SignInScreen`, `PhoneNumberNormalizer`, `FirebaseAuthProvider` in the app target behind the RootView seam, `AppConfig.firebaseProjectId` (same H2 caveat as A3) | — | todo |
| B7 | Family-less profiles (001 §1.5, §4.2–4.3): nullable `familyId`/`role` in `UserProfile`/`AuthContext`, `PROFILE_NOT_FOUND`, four-endpoint bootstrap allowance, family-less own-devices listing + full-field own-device PATCH | — | todo |
| B8 | Re-key `Devices`+`LastKnown` to PK=`ownerUserId` (002 §2.4–2.5): adapters, per-member family reads (§4.2/§5.2/§6.1/§8 fan-out), per-user `maxDevices`, §3.6 cleanup, history-append-only-with-family gate (001 §5.1) | B7 | todo |
| B9 | Groups core (001 §12.1–12.3 + §12.6; 002 §2.10–2.13): `Groups`/`GroupCodes`/`GroupExpiry` tables + `Users` `group:` reverse index, derived state + lazy expiry, 6 new error codes, PLAN_MATRIX group limits + `flags.groups`, owner-plan capacity rule | B7 | todo |
| B10 | Group controls (001 §12.4–12.5, §12.7–12.9): patch (extend/reactivate/end-early), delete (inline hard delete), rotate, kick, leave + `GroupExpiry` row maintenance | B9 | todo |
| B11 | Group live locations (001 §5.1 fan-out side effect, §12.10; 002 §2.12): ingest fan-out to `GroupLastKnown` (active-only, position-only, only-newer) + group latest endpoint with `isStale` | B8, B9 | todo |
| B12 | Group sweeper (002 §4.1, §6): **first timer-triggered function**, 45-day bucket walk, per-policy physical deletion, idempotent re-run + Azurite integration tests | B10, B11 | todo |
| H3 | Verify the deployed timer trigger fires on `func-whereiswaldo` after B12 (consumption-plan schedule locks use the host's `AzureWebJobsStorage`; check one logged run) | B12 | human |
| A4 | Android groups client layer (003 §5/§6.1): `GroupsApi` port + DTOs (10 endpoints), 6 new error codes mapped + user messages (27 total) | — | todo |
| A5 | Android groups screens (003 §12.2): list (= family-less home) / create (policy privacy copy) / detail + share code / join + `waldo://group-join` deep link / group map (position-only), nav additions | A3, A4 | todo |
| I4 | iOS groups client layer (004 §3.1–3.2): WaldoKit client methods + DTOs (10 endpoints), 6 new `APIErrorCode` cases (27 total) | — | todo |
| I5 | iOS groups screens (004 §3.4): same inventory as A5, `AppRoute` additions, deep-link parsing in WaldoKit | I3, I4 | todo |

**Mobile H1-waiver (user directive, 2026-07-19):** the mobile clients code against **specs/001 (complete, normative)**, not the backend implementation, so they run now with H1 (Azure/Firebase provisioning) still `human`/pending. All H1-dependent runtime bits — real `google-services.json`/`GoogleService-Info.plist`, live backend base URL, real Firebase project — are **stubbed behind interfaces and gitignored**; wire them for real when H1 is done. No secrets committed. **Final deliverable (do LAST, after coding is maximized):** a design-generation prompt (`docs/design-prompt.md`) targeting each app's documented design-token contract, so a design tool can produce the iOS + Android visual design that drops into the swappable layer.

**Working the backlog:** invoke **`/dev-loop`** (skill in `.claude/skills/dev-loop/`) — e.g. `/dev-loop parallel 3` runs up to 3 dependency-safe coding agents concurrently in isolated worktrees; every task passes a **code review + security review gate** ([docs/security-review-checklist.md](security-review-checklist.md)) before it may merge. Manual sessions implementing a task directly MUST run the same gate before committing to main.

## Dev-loop log

*(appended by /dev-loop — newest first: date · task · agent rounds · review findings fixed · merge commit)*

- **2026-07-21 · specs 005 + 006 authored (design session, spec-only)** — temporary groups (`specs/005`, commit `e6083b7`: 10 endpoints in 001 §12, 4 new tables + per-user `Devices`/`LastKnown` re-key in 002, derived lifecycle + first-ever timer sweeper, live-only/position-only privacy model) and phone-number-only auth (`specs/006`, commit `7da589f`: client-only change, provider-invisible tokens, Blaze/SMS-allowlist/App-Check ops posture, one-time account reset). Product decisions locked in: groups ≤ 50 members / 5 active / 30 days / 7-day grace; SMS allowlist BE+NL+FR+DE+LU; group map position-only; number change = new account. This entry's commit also lands the docs pass: azure-setup §3 rewritten as H2's phone-auth checklist, security checklist gains phone/group items, and the backlog above gains H2/H3 + B7–B12 + A3–A5 + I3–I5.

- **2026-07-20 · Firebase project ID wired up** — user created the Firebase project (console name "WhereIsWaldo", auto-generated **Project ID `whereiswaldo-30e9c`** — confirmed via Project Settings → General, since Firebase's generated ID commonly differs from the typed display name). Set as the `FIREBASE_PROJECT_ID` app setting on `func-whereiswaldo` (not a secret — same value ships inside `google-services.json`/`GoogleService-Info.plist`, so no confirmation-before-acting concern here, unlike `FCM_SERVICE_ACCOUNT_JSON`). **Still pending (human/secret, docs/azure-setup.md §3):** enable Auth, register Android/iOS apps → `google-services.json`/`GoogleService-Info.plist`, generate + set `FCM_SERVICE_ACCOUNT_JSON`.

- **2026-07-20 · H1 CI pipelines all green + 4 real bugs fixed (`65998a1`)** — after the infra provisioning below, `gh` was used to watch all 3 workflows to a genuinely green state on `main` (not just "should work"). Along the way, running each pipeline for real (most for the *first time ever*) surfaced 5 pre-existing bugs, none introduced by the infra work itself:
  1. **OIDC subject format** — `docs/azure-setup.md`'s federated-credential subject (`repo:owner/repo:ref:...`) doesn't match what GitHub actually presents; the real subject embeds immutable owner/repo IDs (`repo:owner@ownerId/repo@repoId:ref:...`). Fixed via `az ad app federated-credential update`; confirmed by rerunning just the `deploy` job.
  2. **AGP 9 Kotlin plugin conflict** — `org.jetbrains.kotlin.android` is no longer applicable alongside AGP 9's built-in Kotlin support (hard error). Removed from both `mobile/android/build.gradle.kts` and `app/build.gradle.kts`; Compose/serialization sub-plugins untouched.
  3. **iOS Xcode/Swift mismatch on `macos-14` runners** — the default active Xcode's compiler (Swift 5.10) was older than the Testing framework it tried to link (Swift 6.0.3). `ios.yml`'s `package` job now explicitly `xcode-select`s the newest available Xcode 16.x before building.
  4. **Missing import** — `WaldoApiService.kt` used `Envelope<T>` throughout but never imported it (masked until the AGP fix let compilation get that far). One-line fix.
  5. **iOS test race** — `RequestBuildingTests`'s 19 `@Test`s all mutate the same process-global `MockURLProtocol.requestHandler`; Swift Testing runs `@Test`s within a suite concurrently by default (unlike XCTest), so they raced. Added `@Suite(.serialized)`.

  A 6th and 7th bug surfaced on the *first fully green compile+test* of each mobile suite (previously always blocked by #2/#3 above) — genuine app bugs, not environment issues:
  6. **Android: `backgroundScope` + `advanceUntilIdle()` never ran the `init{}`-launched load** in `GeofencesStateHolder`/`HomeStateHolder`/`MapStateHolder`/`SettingsStateHolder` (23 test failures) — confirmed via a minimal local repro (installed a JDK + Android SDK locally via Homebrew to run `./gradlew test` for the first time outside CI). `runCurrent()` reliably drains the same coroutines where `advanceUntilIdle()` doesn't in this project's coroutines-test 1.10.1 setup; swapped in the 4 affected test files. `LocateStateHolderTest` already used `runCurrent()`/`advanceTimeBy()` for an unrelated reason (avoiding racing through intermediate poll states) and was never affected.
  7. **iOS: `GeofencesViewModel.load()` unconditionally reset `state = .loading`** on every call, including refreshes. A `304 Not Modified` response is a no-op in `apply()`, so an unchanged-geofences refresh got stuck on `.loading` forever instead of keeping the prior `.loaded` value — a real UX bug (infinite spinner), not just a test artifact. Fixed to only blank to `.loading` when there's no cached ETag yet (first load).

  Final state: `backend` / `android` / `ios` all green on `main` at `65998a1`. Android: 108/108 unit tests. iOS: 126/126 tests.

- **2026-07-20 · H1 infra provisioned (az + gh)** — resource group **`WhereIsWaldo`** (westeurope): storage **`stwhereiswaldo`** (Standard_LRS, TLS1.2, no public blob, `history-retention` lifecycle 400d), Function App **`func-whereiswaldo`** (consumption, **Node 24**, Functions v4, HTTPS-only, system-assigned MI → Storage Table+Blob Data Contributor), app settings `TABLES_ENDPOINT`/`BLOB_ENDPOINT` (no keys). OIDC app reg **`gh-whereiswaldo-deploy`** (`AZURE_CLIENT_ID` `722f3f16-…`) + federated cred `repo:waldo1001/WhereIsWaldo:ref:refs/heads/main` + `Website Contributor` on the func app. GitHub repo variables set. Branch protection on `main` requires status checks `test`, `mutation`, `android-build`, `ios-package`, `ios-build`. **Node 20→24:** Azure now refuses Node 20 (EOL 2026-04-30) for new Function Apps — provisioned on 24 and bumped `backend.yml` CI to 24 to match. Still say "Node 20" (cosmetic follow-up): project `CLAUDE.md`, `backend/README.md`, specs, `package.json` engines floor (`>=20`, already 24-compatible). **Still human/secret steps:** Firebase project + `FIREBASE_PROJECT_ID` + `FCM_SERVICE_ACCOUNT_JSON` app setting + mobile config files (see `docs/azure-setup.md` §3 and the session's final report for exact commands).

- **2026-07-20 · Design tokens** · applied the delivered "Waldo Design System" (`design/waldo-design-system/`) into both apps' `DesignSystem` seams — colors (light+dark), unified type scale, spacing, corners; elevation + iOS spacing already matched. Values-only (no logic/component/screen changes); self-verified: iOS `swift build`+`--build-tests` clean, no `Color`/`.system`-font leakage outside `DesignSystem` on either app, values match the WCAG-AA-verified handoff exactly. specs/003 §4.2 + specs/004 §2.1 updated · commit `a878f35`.

**Mobile CI-verified status (2026-07-20 update):** both mobile suites now genuinely build **and** run their full test suite in CI (`android-build`: `./gradlew test`, 108/108 green; `ios-package`: `swift test` on `macos-14`, 126/126 green) — see the H1 CI entry above for the bugs this first real run surfaced and fixed. Still outstanding: the iOS `.xcodeproj` app-target project doesn't exist yet (`ios-build` is still a structure-check stub), and Android release signing isn't configured.

**Known follow-ups / tech-debt (raised in review, deliberately deferred):**
- **`apiCalls` placement.** All domain use-cases increment `apiCalls` only on the success path (B1 pattern, mirrored by B2/B3), but §9 says "+1 per authenticated request, once auth succeeds." Since Usage is telemetry-not-billing (002 §2.9), deferred: move the `apiCalls` increment into the shared `authGuard`/HTTP layer so every authenticated request (incl. 4xx) counts exactly once — do it across B1+B2+B3 together, not piecemeal.
- **Catch-all error logging.** Function `errorResponse()` catch-alls log the raw `err` object. No demonstrated leak (Azure `RestError.request/response` are non-enumerable, so coordinates aren't serialized), but harden to log `err.message`/`err.code` only, across all `*.functions.ts`.

- **2026-07-19 · B6** · 1 round · reviews: code + security both **approved** (history read/cursor; **Azurite integration suite ran 18/18**; TLS-downgrade verified LOCAL-ONLY — `allowInsecureConnection` never reaches the `DefaultAzureCredential` prod branch; malicious-cursor injection-safe — flat blob names, `familyId` always first path segment). Deferred 2 §6 integration items: invite single-use race (B3 now merged → nowtestable, add later) + geofence ETag 412→409 (needs B5). Result: 265 tests, mutation 99.53% · merge `a6384b0`.
- **2026-07-19 · B4** · 2 rounds (initial + 1 fix) · reviews: both reviewers found the SAME **1 major, fixed** — `fulfillLocateRequest` was missing the §1.2 `X-Device-Id` ownership check (exploitable: any family member could inject a forged fix into another member's last-known/history); fix adds the `DEVICE_NOT_FOUND` ownership guard before the target-match check, with a dedicated SECURITY test proving the exploit is blocked. FCM §8 credential runtime-only (no key committed). Result: 150 locate tests, mutation 100% on domain/locate · merge `214fbc4`.
- **2026-07-19 · I2** · 2 rounds (initial + 1 fix) · reviews: security **approved** (invite/deep-link validated pre-network; MapKit keyless; no ATS weakening; no PII logging), code review found **4 completeness gaps fixed** — History date-range UI (+client-side 31-day span enforcement), self-management own-row controls (Step down/Leave, server `lastParent` enforced), geofence icon field, device-rename wired in (all with tests). `swift build`/`--build-tests` clean; design seam grep-clean. Test runtime is CI-only (CLT host). · merge `88fc0fc`. **← all coding complete.**
- **2026-07-19 · A2** · 2 rounds (initial + 1 fix) · reviews: security **approved** (maps key config-injected/not committed; no cleartext weakening; invite input safely serialized), code review found **1 medium fixed** — screens were rendering raw `ApiError.message` (server debug text, forbidden by §1.3/§10); now an exhaustive `ApiErrorUserMessage.kt` maps every code→friendly string (mirrors iOS). **A1 retry-duplication carryover resolved** (single `withAuthRetry`). Design seam grep-clean; 3 new design components. Not compiled locally (no toolchain) — CI-compiled. · merge `8193eab`.
- **2026-07-19 · B5** · 1 round · reviews: code + security both **approved** (§1.2 device-ownership on report-events PRESENT — mirrors reportLocations, B4's gap does not recur; parent-only PUT; ETag `"0"`-sentinel/`If-Match`/`412→409` verified against real Azurite; flag-filtered fan-out excludes reporter; frozen null fields for unknown geofenceId; no secrets; cross-family push isolation intact). Non-blocking notes: `apiCalls`-on-all-dup-batch (per-event idempotency makes it defensible — arguably MORE correct than reportLocations' skip) + a cosmetic mid-batch pushInvalid cache-refresh nit. Result: 328 tests, mutation 99.61% (geofence domain 100%), integration 23/23 · merge `741f4b4`. **← backend complete.**
- **2026-07-19 · I1** · 2 rounds (initial + 1 fix) · reviews: code review **approved** — `swift build` + `swift build --build-tests` compile clean on the CLT-only host (test *runtime* runs in CI on `macos-14`); design-swappable seam verified (no `Color(`/`.font(.system)`/hardcoded sizes outside DesignSystem; strict Screens→Components→Theme→Tokens); all 21 error codes; write-only tokens; Location Push entitlement commented-out. Security **approved** (no secrets/config tracked; **1 minor fixed** — added `*.p8` to `mobile/ios/.gitignore`). Not run locally (CLT test-runtime defect) — 55 `@Test`s run in CI. · merge `2144d3f`.
- **2026-07-19 · A1** · 2 rounds (initial + 1 fix) · reviews: code review **approved** (design-swappable seam verified — no hardcoded `Color/dp/sp` outside token dir; full 001 client; all 21 error codes mapped; scope=foundation only), security **approved** (no secrets/config tracked; **3 minor fixed** — cleartext carve-out scoped to `src/debug/` so release is TLS-only, CI `permissions: contents:read`, comment 20→21). Not locally compiled (no Android toolchain) — CI-compiled later. · merge `8bbf4eb`.
- **2026-07-19 · B3** · 2 coding rounds (initial + 1 fix) · reviews: code review **approved** (invite CSPRNG Crockford, race-safe single-use, last-parent protection, §3.6 device cleanup all verified); security found **1 minor fixed** — `userId` path param now zod-validated (rejects empty + Table-Storage-forbidden chars) so a bad key yields `VALIDATION_FAILED` not a masked `INTERNAL_ERROR`; 2 equivalent `refine`-message mutants accepted. Merged behind B2 with a trivial additive `validate.ts` conflict resolved by the orchestrator. Result: 153 tests, mutation 99.51% (break 60), build clean · merge `16115fc`.
- **2026-07-19 · B2** · 2 coding rounds (initial + 1 fix) · reviews: security **approved** clean; code review found **1 major fixed** — `details.fields` now uses bracket notation `fixes[3].recordedAt` (§5.1/§10) instead of dot, killing the deferred B1 `validate.ts` mutant with the correct format — **+1 minor fixed** (`lastKnownTableRepo` retry 2→1 per 002 §2.5); `apiCalls` note deferred to tech-debt above. Result: 89 tests, mutation 100% (365 mutants, break 60), build clean · merge `dad39f9`.

- **2026-07-19 · B1** · 2 coding rounds (initial + 1 fix) · reviews: code+security both ran; **1 finding fixed** — `firebaseJoseVerifier.ts` now enforces §2.2 "iat in the past" (jose omits it without `maxTokenAge`); **1 finding deferred to B2** — surviving `validate.ts` mutant (`.join(".")` vs `.join("")`), unobservable on B1's flat schemas, must be killed by a nested-path test in B2 batch validation · spec change: **specs/001 §4.1 pinned** (omitted token on update = preserve). Result: 46 tests, mutation 99.37% (break 60), build clean · merge `708a6fa`.

Keep this file updated at the end of every session (status table, backlog statuses, log).
