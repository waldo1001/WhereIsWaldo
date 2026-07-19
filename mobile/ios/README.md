# Where's waldo — iOS app (Swift)

**I1 (foundation) + I2 (feature screens) implemented.** Normative design: [`specs/004-ios-client.md`](../../specs/004-ios-client.md) — read that first; it owns the architecture, the design-system token contract, the full 001 endpoint mapping, auth/token-refresh, the fix-queue model, and the location/push strategy (000 §O1). Wire contract: [`specs/001-api-contract.md`](../../specs/001-api-contract.md). Product context: [`specs/000-overview.md`](../../specs/000-overview.md), esp. open items **O1–O4, O9**.

## What's here

```
mobile/ios/
├── WaldoKit/         ← Swift Package — ALL logic + the design system. Builds & tests headlessly:
│   │                    `cd WaldoKit && swift build && swift test`
│   ├── Sources/WaldoKit/   Config, Networking (full 001 client, 19 endpoints), Auth, Device,
│   │                       Locations (offline fix-queue), LocationSensing, Push, DesignSystem
│   │                       (tokens/theme/11 components), Navigation, Screens/ — sign-in (I1) +
│   │                       Home, Map (live map + swappable MapKit/list `MapRendering`), History
│   │                       (cursor pagination), Geofences (list/editor, ETag-aware save +
│   │                       version-conflict merge UX), Locate (create + poll-to-terminal),
│   │                       Settings (device + family members), Invites (create + accept, with
│   │                       deep-link validation) — all I2
│   └── Tests/WaldoKitTests/   Swift Testing suite (see specs/004 §9 for why not XCTest here)
└── WheresWaldo/      ← Thin SwiftUI app-target SOURCE FILES (App lifecycle + composition root
                         only, zero business logic). No `.xcodeproj` is committed yet — see
                         specs/004 §1.1 for why and how to create one.
```

**I2** adds the feature screens on top of I1's foundation: live map (§5.2), history (§5.3),
geofences list/editor (§7.1–7.2), locate-to-request (§6), device/family settings
(§4.2–4.3/§3.5–3.6), invites (§3.3–3.4) — same design system, no changes to `DesignSystem/Tokens`
or `Theme`; two new stateless components (`WaldoTextField`, `WaldoToggleRow`) were added to
`DesignSystem/Components/` for the new forms.

## Build & test

```bash
cd WaldoKit
swift build          # the package — logic + design system
swift build --build-tests   # also compiles the test target
swift test            # runs the Swift Testing suite (needs a host where Testing.framework
                       # actually executes tests — see specs/004 §9 for a documented gap on
                       # Command-Line-Tools-only hosts, worked around in this session via an
                       # out-of-tree harness; unaffected on a normal Xcode/CI machine)
```

The `WheresWaldo/` app-target sources type-check against the built `WaldoKit` module
(`swiftc -typecheck -I WaldoKit/.build/.../Modules -L WaldoKit/.build/... WheresWaldoApp.swift RootView.swift`)
but are not wrapped in an Xcode project yet — do that in Xcode (File → New → Project → App,
point sources at this folder, add `WaldoKit` as a local Swift Package dependency), then build with
Xcode 16+ / `xcodebuild`. CI: `.github/workflows/ios.yml` (currently a structure check; real
`xcodebuild` + signing steps are stubbed there as TODO — requires Apple Developer account, $99/yr,
and blocks on the `.xcodeproj` existing).

## Key decisions (see specs/004 for the full normative text)

- **Location sync:** `CLLocationManager` with Always authorization (staged onboarding: When-In-Use → Always upgrade prompt); background fixes via significant-change monitoring + `BGAppRefreshTask` opportunistic scheduling — scaffolded behind `LocationProviding`/`BackgroundSyncScheduling`, real on-device wiring is a runtime TODO (needs a device/simulator this session doesn't have). iOS does not honor exact periodic intervals — the interval is a *target*; the UI (I2) must document the delivered cadence honestly.
- **Push-to-locate (000 §O1 — the #1 platform risk):** correct mechanism is the **Location Push Service Extension** (`com.apple.developer.location.push`, `apns-push-type: location`) — **apply to Apple for this entitlement immediately** (human/Apple-account action, not blocking). Until granted, the backend's data-only `LOCATE_REQUEST` push is used exactly as normatively specified; UI (I2) falls back to "last known, updating…". `LocationPushTokenHandling` scaffolds the token capture/registration path so wiring the extension in later is additive only.
- **Geofencing:** `CLCircularRegion` monitoring (max 20 regions — `features.limits.maxGeofences`, 000 §O9) is an I2 concern; `WaldoKit`'s geofences client methods exist now.
- **Push tokens:** FCM/APNs token registered via `PushTokenProviding` → `DeviceRegistrationService`, re-`POST /devices` on every refresh (001 §4.1, 000 §O4).
- **Auth:** `AuthProviding` abstraction; `StubAuthProvider` (unsigned dev token, matches backend `AUTH_MODE=insecure-local`) is the only I1 implementation — `FirebaseAuthProvider` is an H1 follow-up, one new type + a composition-root swap.
- **Offline:** `FixQueue` (actor) — freeze-on-first-send `batchId` idempotency, in-memory queue today (Core Data/SQLite persistence is a runtime TODO), batch upload per 001 §5.1.
