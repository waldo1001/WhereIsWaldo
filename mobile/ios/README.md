# Where's waldo — iOS app (Swift)

**Not implemented yet.** This directory is reserved for the native iOS app, built by its own session against the specs — read [`specs/001-api-contract.md`](../../specs/001-api-contract.md) (wire contract) and [`specs/000-overview.md`](../../specs/000-overview.md) (product + open item **O1 — critical for this app**) before writing any code. A `004-ios-client.md` spec must exist before implementation starts (see [`specs/README.md`](../../specs/README.md)).

## Planned shape

- **Targets:** SwiftUI app target + (once granted) a **Location Push Service Extension**. iOS 16+.
- **Location sync:** `CLLocationManager` with Always authorization (staged onboarding: When-In-Use → Always upgrade prompt); background fixes via significant-change monitoring + `BGAppRefreshTask` opportunistic scheduling. iOS does not honor exact periodic intervals — the interval is a *target*; document the delivered cadence honestly in the UI.
- **Push-to-locate (000 §O1 — the #1 platform risk):** correct mechanism is the **Location Push Service Extension** (`com.apple.developer.location.push`, `apns-push-type: location`) — **apply to Apple for this entitlement immediately**. Until granted, the backend sends background pushes (`content-available: 1`) which iOS budgets/coalesces: fulfill best-effort, UI shows "last known, updating…".
- **Geofencing:** `CLCircularRegion` monitoring (max 20 regions — the reason for `features.limits.maxGeofences`, 000 §O9); re-register on `GEOFENCE_CONFIG_CHANGED` push or `geofenceEtag` change.
- **Push:** FCM SDK or raw APNs token registered via FCM; handle the four data-message types of 001 §8.
- **Auth:** Firebase Auth; ID token as `Authorization: Bearer`; re-`POST /devices` on token refresh.
- **Offline:** queue fixes (Core Data/SQLite), batch upload with stable `batchId` (001 §5.1).

## Build (once implemented)

Xcode 16+, Swift 5.10+. CI: `.github/workflows/ios.yml` (currently a structure check; real `xcodebuild` + signing steps are stubbed there as TODO — requires Apple Developer account, $99/yr).
