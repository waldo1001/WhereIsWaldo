# Where's waldo — Android app (Kotlin)

**Not implemented yet.** This directory is reserved for the native Android app, built by its own session against the specs — read [`specs/001-api-contract.md`](../../specs/001-api-contract.md) (wire contract) and [`specs/000-overview.md`](../../specs/000-overview.md) (product + open items O2/O3/O4) before writing any code. A `003-android-client.md` spec must exist before implementation starts (see [`specs/README.md`](../../specs/README.md)).

## Planned shape

- **Modules:** single-module app first (`app/`), Kotlin, Jetpack Compose, min SDK 26.
- **Location sync:** `FusedLocationProviderClient`; intervals ≥ 15 min via **WorkManager** periodic work; 5/10-min intervals require a **foreground service** with a persistent low-priority notification (Play-policy compliant for family tracking). "1 day" = first unlock/network of the device-local day (000 §O3).
- **Geofencing:** `GeofencingClient` (native, battery-efficient); re-register on `GEOFENCE_CONFIG_CHANGED` push or `geofenceEtag` change (001 §5.1 piggyback).
- **Push:** Firebase Cloud Messaging; handle the four data-message types of 001 §8. `LOCATE_REQUEST` → high-priority wake → single high-accuracy fix → `POST /locate-requests/{id}/fulfill`.
- **Auth:** Firebase Auth; attach ID token as `Authorization: Bearer`; re-`POST /devices` on every FCM token refresh (001 §4.1).
- **Offline:** queue fixes locally (Room), upload as batches with a stable `batchId` for idempotent retry (001 §5.1).
- **Permissions:** `ACCESS_FINE_LOCATION` → `ACCESS_BACKGROUND_LOCATION` staged request; Play Store background-location review prep (000 §O2).

## Build (once implemented)

Gradle (Kotlin DSL), JDK 17. CI: `.github/workflows/android.yml` (currently a structure check; real build steps are stubbed there as TODO).
