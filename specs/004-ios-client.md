# 004 — iOS client

## Goal

The normative design for the native iOS app: a headless-testable **Swift Package (`WaldoKit`)** holding all logic and the design system, plus a thin SwiftUI app target that wires it to the OS. Builds against [`specs/001-api-contract.md`](001-api-contract.md) (wire contract, complete) and [`specs/002-storage-schema.md`](002-storage-schema.md) (context only — the client never talks to storage directly) and [`specs/000-overview.md`](000-overview.md) (product, esp. **§Open Items O1–O4, O9**). This spec is scoped to **I1 — foundation**: networking, auth abstraction, device registration, the offline fix-queue, navigation scaffold, one proof screen, and — the key architectural requirement — a **design-swappable UX layer**. Feature screens (map, history, geofences editor, locate, settings, invites) are **I2**, out of scope here.

---

## 1. Architecture

### 1.1 SPM-package + app-target split

```
mobile/ios/
├── WaldoKit/                  ← Swift Package, iOS 16 + macOS 13 platforms
│   ├── Package.swift
│   ├── Sources/WaldoKit/      ← ALL logic + design system (no app lifecycle code)
│   └── Tests/WaldoKitTests/   ← XCTest, runs via `swift test` on any host (incl. this macOS
│                                  session, headlessly — no simulator needed)
├── WheresWaldo/                ← thin SwiftUI app-target sources (App.swift, RootView, Info.plist,
│                                  entitlements) — App lifecycle + environment wiring ONLY, zero
│                                  business logic; depends on WaldoKit as a local package
└── WheresWaldo.xcodeproj/      ← Xcode project wrapping the above; built by Xcode/CI, not by this
                                   session (no Xcode.app / simulator available in this environment —
                                   only Command Line Tools; `xcodebuild` fails with
                                   "requires Xcode" here). NOT part of this session's verification.
```

**Rule (MUST):** any line of business logic, networking, persistence, or design-system code lives in `WaldoKit`. The app target MAY contain only: `@main App` struct, scene/window wiring, `Info.plist`/entitlements, and passing the OS lifecycle (scene phase, push-registration callbacks, `BGTaskScheduler` registration) into `WaldoKit` types through their public protocols. This split is what makes `swift build`/`swift test` run green on a plain macOS host with no Xcode project involved — the thing this session can actually verify.

**Platform gating (MUST):** `WaldoKit`'s `Package.swift` declares `platforms: [.iOS(.v16), .macOS(.v13)]`. Any file that imports an iOS-only framework (`CoreLocation`'s background APIs, `UIKit`, `BackgroundTasks`) MUST gate the import and the real implementation behind `#if os(iOS)` / `#if canImport(...)`, with a platform-agnostic protocol + a fake/no-op implementation available on all platforms so the package compiles and its tests run on macOS. Real device behavior (GPS fixes, background scheduling) is exercised only when the app runs on-device/in-simulator — out of scope for this session's verification, called out per-component below.

### 1.2 Module layout inside `WaldoKit`

| Folder | Owns |
|---|---|
| `Config/` | `AppConfig` — base URL, auth mode; the one place H1-dependent values are injected |
| `Networking/` | `Envelope<T>`, `APIErrorCode`, `APIErrorBody`, `JSONValue`, `WaldoAPIClient` protocol + `URLSessionAPIClient`, one file per endpoint group (`FamiliesEndpoints`, `DevicesEndpoints`, `LocationsEndpoints`, `LocateEndpoints`, `GeofencesEndpoints`) holding that group's request/response DTOs + client methods |
| `Auth/` | `AuthProviding` protocol, `StubAuthProvider` (dev), token-refresh plumbing |
| `Device/` | `DeviceIdProviding` (+ `UserDefaultsDeviceIdProvider`), `DeviceRegistrationService`, `PushTokenProviding` (+ stub) |
| `Locations/` | `LocationFix`, `FixQueue` (batch/idempotency model), `FixStoring` (+ in-memory impl) |
| `LocationSensing/` | `LocationProviding` protocol, `SystemLocationProvider` (`#if os(iOS)`), `BackgroundSyncScheduling` (`#if canImport(BackgroundTasks)`) — scaffolding, real GPS/BG wiring is a runtime TODO |
| `Push/` | `LocationPushTokenHandling` — scaffolding for §8.1 / 000 §O1, entitlement pending (see §5) |
| `DesignSystem/` | `Tokens/` (color, typography, spacing, corner, elevation), `Theme`, environment injection, `Components/` (stateless presentational views) |
| `Navigation/` | `AppRoute`, `AppCoordinator` |
| `Screens/` | View models + SwiftUI views composed **only** from `DesignSystem/Components` |

---

## 2. Design-system contract

The visual design MUST be fully replaceable later without touching any logic, navigation, or view-model code. This is achieved by a strict one-way dependency: `Screens` → `DesignSystem.Components` → `DesignSystem.Theme` → `DesignSystem.Tokens`. Nothing above the `DesignSystem` layer references a concrete `Color`, point size, or `Font` — only semantic token names.

### 2.1 Token vocabulary (normative — identical names to the Android client, `specs/003-android-client.md`, for one design → both platforms)

**Colors** (`ColorTokens`, one instance per scheme):

| Token | Light (default) | Dark (default) |
|---|---|---|
| `primary` | `#2F6FED` | `#6C9BFF` |
| `onPrimary` | `#FFFFFF` | `#04174D` |
| `secondary` | `#5856D6` | `#9D9CFF` |
| `surface` | `#FFFFFF` | `#1C1C1E` |
| `onSurface` | `#1C1C1E` | `#F2F2F7` |
| `surfaceVariant` | `#F2F2F7` | `#2C2C2E` |
| `danger` | `#D70015` | `#FF6961` |
| `onDanger` | `#FFFFFF` | `#340003` |
| `success` | `#248A3D` | `#63D471` |
| `warning` | `#FF9500` | `#FFB340` |
| `outline` | `#C6C6C8` | `#48484A` |

**Typography** (`TypographyTokens`, identical across schemes — a `TypeStyle { font: Font, weight, size }` per role):

| Role | Size (pt) | Weight |
|---|---|---|
| `displayLarge` | 34 | bold |
| `titleLarge` | 22 | bold |
| `titleMedium` | 17 | semibold |
| `bodyLarge` | 17 | regular |
| `bodyMedium` | 15 | regular |
| `labelSmall` | 12 | medium |

**Spacing** (`SpacingTokens`, `CGFloat` points): `xs=4, sm=8, md=12, lg=16, xl=24, xxl=32`.

**Corner radius** (`CornerRadiusTokens`, `CGFloat` points): `sm=4, md=8, lg=16, pill=9999` (pill = always fully rounded regardless of view height).

**Elevation** (`ElevationTokens`, a shadow spec per level — SwiftUI has no native elevation, so each level is `{ radius: CGFloat, y: CGFloat, opacity: Double }`): `level0 = {0,0,0}` (no shadow), `level1 = {2,1,0.08}`, `level2 = {4,2,0.12}`, `level3 = {8,4,0.16}`.

### 2.2 `Theme` and injection

```swift
public struct Theme: Equatable {
    public var colors: ColorTokens
    public var typography: TypographyTokens
    public var spacing: SpacingTokens
    public var corner: CornerRadiusTokens
    public var elevation: ElevationTokens
    public static let light = Theme(colors: .light, typography: .standard, spacing: .standard, corner: .standard, elevation: .standard)
    public static let dark  = Theme(colors: .dark,  typography: .standard, spacing: .standard, corner: .standard, elevation: .standard)
}
```

Injected via a custom `EnvironmentKey` (`\.theme`), defaulting to `.light`; the app target's root view resolves `.light`/`.dark` from the SwiftUI `colorScheme` environment value and sets `\.theme` once at the root — no component below the root ever reads `colorScheme` directly. **MUST** ship both `Theme.light` and `Theme.dark` from day one.

### 2.3 Components (stateless, presentational, `DesignSystem/Components/`)

`WaldoButton` (primary/secondary style), `WaldoCard`, `WaldoListRow`, `StatusChip` (e.g. online/stale/paused), `MapMarkerBubble`, `WaldoNavBar`, `EmptyStateView`, `LoadingStateView`, `ErrorStateView`. Each:

- Reads `@Environment(\.theme)` only — **MUST NOT** declare a literal `Color(...)`, `.font(.system(size:))`, or hardcoded point size.
- Takes content/state via parameters (strings, an enum for chip status, a boolean for loading, etc.) — zero knowledge of view models, networking, or navigation.
- Ships a light + dark `#Preview` pair (compiles under Xcode later; not required for `swift test`, which does not build previews).

### 2.4 Screens

Screens (`Screens/*/*.swift`) compose `DesignSystem.Components` and read state from an `ObservableObject` view model. View models contain **zero** styling — no `Color`, `Font`, or SwiftUI layout modifiers beyond what a generic container view needs; they expose plain state (strings, enums, booleans) that components render. This seam is what lets a future design pass replace every file under `DesignSystem/` without touching `Screens/`, `Navigation/`, `Networking/`, `Auth/`, `Device/`, or `Locations/`.

---

## 3. Networking — full 001 client

`URLSession` + `Codable`, `async`/`await`. One `WaldoAPIClient` protocol (mockable in tests) + `URLSessionAPIClient` (real). Every call sets `Authorization: Bearer <token>` (from `AuthProviding`) and `Content-Type: application/json; charset=utf-8`; device-originated calls additionally set `X-Device-Id` (§1.2 of 001). Base URL from `AppConfig` (§6).

### 3.1 Envelope & error decoding

```swift
public struct Envelope<T: Decodable>: Decodable { public let data: T; public let features: Features }
public struct APIErrorBody: Decodable { public let code: APIErrorCode; public let message: String
                                          public let details: [String: JSONValue]?; public let requestId: String }
public struct APIErrorEnvelope: Decodable { public let error: APIErrorBody }
```

`APIErrorCode` is a `String`-backed enum with one case per 001 §10 row (21 codes) **plus** `case unknown(String)` as a forward-compatible fallback (defensive only — 001 states codes come solely from the catalog; `unknown` never occurs against a conforming server but protects the client against additive server-side codes shipping before the client updates). `Features`/`PlanLimits`/`PlanFlags` mirror 001 §9 exactly.

### 3.2 Endpoint → client method mapping (complete — every row of 001 §1.6)

| 001 § | Method & path | `WaldoAPIClient` method |
|---|---|---|
| 3.1 | `POST /families` | `createFamily(familyName:displayName:)` |
| 3.2 | `GET /families/me` | `getMyFamily()` |
| 3.3 | `POST /families/me/invites` | `createInvite(role:emailHint:)` |
| 3.4 | `POST /invites/accept` | `acceptInvite(inviteCode:displayName:)` |
| 3.5 | `PATCH /families/me/members/{userId}` | `updateMember(userId:role:displayName:)` |
| 3.6 | `DELETE /families/me/members/{userId}` | `removeMember(userId:)` → `Void` (204, no envelope) |
| 4.1 | `POST /devices` | `registerDevice(_:RegisterDeviceRequest)` |
| 4.2 | `GET /devices` | `listDevices()` |
| 4.3 | `PATCH /devices/{deviceId}` | `updateDevice(deviceId:_:UpdateDeviceRequest)` |
| 5.1 | `POST /locations` | `reportLocations(batchId:fixes:)` |
| 5.2 | `GET /locations/latest` | `getLatestLocations()` |
| 5.3 | `GET /locations/history` | `getLocationHistory(userId:deviceId:from:to:limit:cursor:)` |
| 6.1 | `POST /locate-requests` | `createLocateRequest(target:)` (`target` = `.user(String)` \| `.device(String)`) |
| 6.2 | `GET /locate-requests/{requestId}` | `pollLocateRequest(requestId:)` |
| 6.3 | `POST /locate-requests/{requestId}/fulfill` | `fulfillLocateRequest(requestId:fix:)` |
| 7.1 | `GET /geofences` | `getGeofences(ifNoneMatch:)` → `.notModified` \| `.ok(GeofenceConfig, etag:)` |
| 7.2 | `PUT /geofences` | `replaceGeofences(_:ifMatch:)` |
| 7.3 | `POST /geofence-events` | `reportGeofenceEvents(_:)` |
| 7.4 | `GET /geofence-events` | `getGeofenceEventHistory(from:to:userId:limit:cursor:)` |

All request/response field names match 001 verbatim (`camelCase`, identical keys). `syncIntervalMinutes` request validation (allowed set, floor) is **not** duplicated client-side beyond what the UI needs for a sane picker (I2 concern) — the server is the source of truth; the client surfaces `VALIDATION_FAILED`/`LIMIT_EXCEEDED` as returned.

### 3.3 Token-expiry retry (001 §2.1)

`URLSessionAPIClient` catches a decoded `AUTH_TOKEN_EXPIRED` error, calls `authProvider.refreshIDToken()`, and retries the **same** request exactly once; a second `AUTH_TOKEN_EXPIRED` propagates to the caller. This is orthogonal to §4 below (which reacts to the **push**-token refreshing, not the Firebase ID token).

---

## 4. Auth abstraction (Firebase, stubbed)

```swift
public protocol AuthProviding {
    var currentUserId: String? { get }
    func currentIDToken() async throws -> String
    func refreshIDToken() async throws -> String
    func signOut() throws
}
```

`StubAuthProvider` is the only implementation shipped in I1: an in-memory dev/test double producing a fixed `currentUserId` and an **unsigned** token string shaped like a JWT (matching the backend's `AUTH_MODE=insecure-local`, 001 §2.3) — clearly documented as non-production. The real `FirebaseAuthProvider` (Firebase Auth SDK, real ID tokens) is an **H1 follow-up**: adding it means writing one new type conforming to `AuthProviding` and swapping the app target's composition root — zero change anywhere else. No Firebase SDK dependency is added in I1 (no `GoogleService-Info.plist` exists yet; adding the SDK without it would crash at runtime).

**Push-token refresh → re-registration (001 §4.1, 000 §O4):** `PushTokenProviding` exposes an `AsyncStream<String>` of push-token values (FCM/APNs token). `DeviceRegistrationService` subscribes and calls `POST /devices` with the new `pushToken` on every emission — this is what satisfies "re-`POST /devices` on token refresh"; it is **not** triggered by Firebase ID-token refresh (that's §3.3's concern, a different token, a different reason).

---

## 5. Device registration (001 §4.1)

`DeviceIdProviding` persists a client-generated **UUIDv4** `deviceId` keyed by `currentUserId`, generating a **fresh** id whenever the signed-in user changes (001 §1.4: "clients MUST generate a fresh `deviceId` when the signed-in user changes"). `DeviceRegistrationService.registerOrUpdate()` builds a `RegisterDeviceRequest{ deviceId, platform: "ios", model, appVersion, pushToken?, locationPushToken?, deviceName? }` from `DeviceIdProviding` + `UIDevice`/`Bundle` info (gated `#if canImport(UIKit)`, with a fake device-info source for macOS/test builds) and calls `registerDevice`. Triggers (MUST, per 001 §4.1 + the task's runtime wiring, executed by the app target through `WaldoKit`'s public API): first launch after sign-in; every push-token refresh (§4); every app update (compare stored vs. running `appVersion`).

Push tokens are **write-only** (never read back, 001 §4.1/§4.2) — `WaldoKit`'s `Device` response models simply have no `pushToken`/`locationPushToken` fields, by construction, not by filtering.

---

## 6. Offline fix-queue & `batchId` idempotency (001 §5.1)

`FixQueue` (an `actor`, so concurrent enqueue-from-CoreLocation-callback and send-from-background-task are race-free) models the exact rules of 001 §5.1 and 000 §D7:

- **Freeze-on-first-send:** `nextBatchToSend(maxBatchSize: 100)` either returns the **existing in-flight `PendingBatch`** (a retry — same `batchId`, same frozen `fixes`) or, if none is in-flight, freezes up to 100 queued fixes into a **new** `PendingBatch` with a fresh UUIDv4 `batchId` and holds it as in-flight. Fixes recorded after freezing are never added to that batch — they wait for the next one (queue > 100 splits across multiple sequential batches, oldest first).
- **Transient failure** (network error, 5xx): `handleTransientFailure()` — the in-flight batch is kept **unchanged** for the next retry (same `batchId`, identical content, satisfying "retries MUST resend identical content under the same `batchId`").
- **Accepted (2xx, incl. a duplicate-replay 200):** `handleAccepted(batchId:)` — the batch's fixes are permanently removed from the queue; in-flight cleared.
- **Definitive rejection (any 4xx):** `handleDefinitiveRejection(batchId:, dropFixIds:)` — per 001 §5.1 ("no marker was written — the batch is dead"), the offending fixes are dropped (`details.fields`-identified ones, or the whole batch if the client can't map fields) and in-flight is cleared; the **remaining** fixes get a **new** `batchId` on the next `nextBatchToSend` call, never the dead one.
- **Persistence:** `FixStoring` protocol abstracts the queue's backing store; I1 ships `InMemoryFixStore` only — a Core Data/SQLite-backed store is a runtime TODO for the on-device build (not required for `swift test`, which exercises the queue's rules against the in-memory store).

---

## 7. Location & push-to-locate strategy (000 §O1, §O2, §O3; 001 §5–§6, §8)

- **Sync:** `LocationProviding` protocol (foreground high-accuracy fix + background significant-change monitoring); `SystemLocationProvider` (`#if os(iOS)`) wraps `CLLocationManager` with staged authorization (When-In-Use → Always upgrade prompt) — implementation body is scaffolded with `// TODO(I2 or on-device session):` markers for the actual `CLLocationManagerDelegate` wiring, since it cannot be exercised without a device/simulator. `BackgroundSyncScheduling` (`#if canImport(BackgroundTasks)`) scaffolds `BGAppRefreshTask` registration the same way. Both conform to protocols with fully-tested fakes so `FixQueue`/`DeviceRegistrationService` consumers are unit-testable without either framework.
- **Interval honesty (000 §O2):** the UI (I2) must present the configured interval as a *target*; this spec's models carry `syncIntervalMinutes` verbatim from the server — no client-side reinterpretation.
- **"1 day" interval (000 §O3):** scheduling semantics (first opportunistic fix per device-local calendar day) belong to the on-device scheduler (I2/runtime), not to any I1 type; noted here so the eventual scheduler implementation has a normative pointer.
- **Push-to-locate reliability (000 §O1 — the #1 platform risk):** `LocationPushTokenHandling` scaffolds capture of the APNs Location Push token (`CLLocationManager.startMonitoringLocationPushes`, `#if os(iOS)`) and its plumbing into `RegisterDeviceRequest.locationPushToken` (§5 above) — the token is captured and sent the moment it's available, exactly like `pushToken`. **The `com.apple.developer.location.push` entitlement itself is a human/Apple-account action** (Apple Developer Program enrollment, $99/yr, then a formal entitlement request) — **apply immediately**; it is explicitly **not** blocking I1/I2 coding. Until granted, the client relies on the FCM data-only `LOCATE_REQUEST` push (001 §8.1) exactly as normatively specified, with UI (I2) falling back to "last known, updating…" per 000 §O1. The Location Push Service Extension **target** itself (a second app extension target using the entitlement) is not created in I1 — it has no code to write until the entitlement exists; adding it later is purely additive (a new Xcode target, no changes to `WaldoKit`).
- **Geofencing (000 §O9):** out of scope for I1 (I2 builds the editor + `CLCircularRegion` registration); `WaldoKit`'s `GeofencesEndpoints` client methods exist now so I2 has them ready.

---

## 8. Config & H1-dependent stubbing

```swift
public struct AppConfig {
    public var baseURL: URL             // default: a placeholder, non-resolving host — see below
    public var authMode: AuthMode       // .stubLocal (default) | .firebase
}
public enum AuthMode { case stubLocal, firebase }
```

Default `baseURL` is `https://api.wheres-waldo.invalid/api/v1` — the `.invalid` TLD (RFC 2606) makes it obviously non-resolving and non-real, so no third-party/production host is ever hardcoded. H1 supplies the real Azure Functions base URL (and a `.firebase` `AuthMode` backed by `FirebaseAuthProvider`) via the app target's build configuration (e.g. an `.xcconfig` per environment) — no `WaldoKit` code changes. `GoogleService-Info.plist` stays **absent and gitignored** (already covered by `mobile/ios/.gitignore`) until H1; the app target's Firebase SDK integration itself is also an H1 follow-up (adding the SDK now, with no config file, would crash at launch).

---

## 9. Testing strategy

XCTest, `Tests/WaldoKitTests/`, runs via `swift test` on any host (this session: macOS, headless, no simulator). Coverage (see §10 checklist for the full list): envelope success/error decoding; all 21 `APIErrorCode` cases decode to their case (plus one forward-compat `unknown` case); request-building for every method in §3.2 (URL, HTTP method, headers incl. `X-Device-Id` only where required, JSON body shape); device-registration request construction (first-registration defaults are the server's job, but the client's *request* omits fields it doesn't have, and never sends role/entitlement data); `FixQueue` batch/idempotency behavior (freeze, retry-same-id, split >100, definitive-rejection new-id, transient-failure same-id); token-refresh triggers (push-token refresh ⇒ re-register call recorded; `AUTH_TOKEN_EXPIRED` ⇒ refresh + retry-once observed on a mock client); design-system `Theme` (light/dark both defined, all token fields present); `SignInViewModel` state transitions (idle → loading → signedIn/error). The Xcode app-target build (and any `xcodebuild`/simulator run) is explicitly **not** part of this session's verification — noted, not attempted, since only Command Line Tools (no Xcode.app) are present here.

---

## 10. Test checklist

- `Envelope<T>` decodes `{data,features}`; `APIErrorEnvelope` decodes `{error:{code,message,details,requestId}}`.
- Every one of the 21 `APIErrorCode` catalog values round-trips through decoding; an unrecognized string decodes to `.unknown`.
- One request-building test per §3.2 row (15 methods) asserting method, path, headers, and body against a 001 example.
- `X-Device-Id` header present only on `reportLocations`, `reportGeofenceEvents`, `fulfillLocateRequest`; absent elsewhere.
- `removeMember` and a `304` `getGeofences` response are handled without attempting envelope decode.
- `DeviceIdProviding` issues a stable id per user and a fresh one when the user changes.
- `DeviceRegistrationService` builds a request with `platform: "ios"` and omits absent optional token fields (never sends empty-string tokens).
- `FixQueue`: enqueue→freeze→same-batch-on-retry; accept clears queue; definitive rejection drops + issues new id on next send; queue > 100 splits into sequential batches.
- Push-token refresh triggers exactly one `registerDevice` call with the new token; ID-token expiry triggers exactly one refresh + one retry, not a device re-registration.
- `Theme.light` and `Theme.dark` both populate every token in §2.1; components read only `\.theme` (spot-checked by a components test asserting no direct `Color(...)` literal type is reachable — enforced by code review, not automatable in XCTest, so this is a review-gate item, not a test).
- `SignInViewModel`: `.idle` → `.loading` on submit → `.signedIn` on success / `.error(message)` on failure, and back to `.idle`-equivalent retry affordance.

## 11. Open questions

None — ambiguities in 001/000 relevant to this client (O1–O4, O9) have normative v1 behavior already; anything left (real `CLLocationManager`/`BGTaskScheduler` wiring, the Location Push extension target, feature screens) is explicitly deferred to I2 or to H1/human action, not an open question against this spec.
