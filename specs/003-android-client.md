# 003 — Android client (Kotlin / Jetpack Compose)

## 1. Goal

The Android client for Where's waldo: a single-module Jetpack Compose app that implements the **complete** wire contract of [`specs/001-api-contract.md`](001-api-contract.md), with a **design-swappable UX layer** so the visual design can be replaced later without touching any business logic. This spec is normative for the Android session; it does not redefine any wire shape (those live in 001 only) or storage shape (002 only). Product context and open items (O1–O10) are in [`specs/000-overview.md`](000-overview.md).

This task (**A1**) builds the **foundation only**: networking for all of 001 §3–§7, auth + device-identity + push-token abstractions, the offline fix-queue idempotency model (§5.1), a navigation scaffold, one proof screen, and the design-system layer itself. Feature screens (live map, history, geofence editor, locate-to-request UI, settings) are **task A2** and are explicitly out of scope here.

## 2. Scope & non-scope

**In scope (A1):**
- Gradle (Kotlin DSL) project skeleton, min SDK 26, target/compile SDK 35, JDK 17.
- A typed network client covering every endpoint in 001 §3–§7, the `{data,features}` / `{error}` envelopes, and the complete §10 error catalog.
- `AuthProvider` abstraction (Firebase Auth ID token source) with a dev/stub implementation; no real `google-services.json`.
- `PushTokenProvider` abstraction (FCM registration token source) with a stub implementation; the re-`POST /devices`-on-refresh trigger (§4.1, 000 §O4).
- Device registration (§4.1) end-to-end at the data/viewmodel layer.
- Offline fix-queue scaffolding with the §5.1 `batchId` idempotency model — logic + tests. The periodic upload worker is scaffolded with runtime TODOs (no real scheduling wired yet).
- Navigation scaffold + one proof screen ("Home"), rendered only through the design system, in light and dark.
- The design-system layer: tokens, `WaldoTheme`, stateless presentational components.

**Out of scope (A2 or later):**
- Live map, history replay, geofence editor, push-to-locate UI, device/family settings screens, invite UI.
- Real Firebase Auth / FCM wiring (needs `google-services.json`, waived per H1 — see §13).
- Real platform geofencing registration, foreground service implementation, WorkManager enqueue call sites (scaffolded, not activated).
- Persistent (Room) fix-queue storage — see §10.4 for the explicit deferral and rationale.

## 3. Module & package architecture

Single Gradle module, per `mobile/android/README.md`'s stated plan ("single-module app first"):

```
mobile/android/
├── settings.gradle.kts, build.gradle.kts, gradle.properties
├── gradle/wrapper/gradle-wrapper.properties   (wrapper jar/scripts generated later — see §13.4)
└── app/
    ├── build.gradle.kts
    └── src/
        ├── main/java/com/whereswaldo/android/
        │   ├── WaldoApplication.kt, AppContainer.kt, MainActivity.kt
        │   ├── config/            AppConfig.kt (BuildConfig → typed config, §13)
        │   ├── auth/               AuthProvider, AuthState, DevAuthProvider, FirebaseAuthProviderStub
        │   ├── push/               PushTokenProvider, StubPushTokenProvider
        │   ├── device/             DeviceIdStore/Provider, DeviceInfoProvider, DeviceRegistrar
        │   ├── network/            DTOs (dto/), ApiError, ApiErrorMapper, ApiResult, ports/ (FamilyApi,
        │   │                       DevicesApi, LocationsApi, LocateApi, GeofenceApi), WaldoApiService
        │   │                       (Retrofit interface), WaldoApiClient (implements the ports),
        │   │                       AuthInterceptor, RetrofitFactory, FeaturesMapper
        │   ├── queue/              QueuedFix, FixBatch, FixQueueStore, InMemoryFixQueueStore,
        │   │                       LocationSyncCoordinator, worker/ (LocationSyncWorker, Scheduler — scaffold)
        │   ├── pushmessages/        PushMessageType (FCM `data.type` discriminator + parser)
        │   └── ui/
        │       ├── designsystem/   token/ (Color, Typography, Spacing, Corner, Elevation), WaldoTheme,
        │       │                   components/ (Button, Card, ListRow, StatusChip, MapMarkerBubble,
        │       │                   TopBar, EmptyState, LoadingState, ErrorState)
        │       ├── nav/            Destinations, WaldoNavHost
        │       └── home/           HomeUiState, HomeStateHolder (pure), HomeViewModel (thin), HomeScreen
        └── test/java/com/whereswaldo/android/   (JVM unit tests mirroring the tree above)
```

**Rule (mirrors `backend/README.md`'s hexagonal split):** everything under `network/`, `queue/`, `auth/` (state, not the Android-specific stub wiring), `device/` (state, not `SharedPreferencesDeviceIdStore`), `pushmessages/`, and the `HomeStateHolder` is **pure Kotlin/JVM logic with zero `android.*` framework imports** — unit-testable with plain JUnit, no emulator, no Robolectric. Only the thin Android-framework touch points (`WaldoApplication`, `MainActivity`, `SharedPreferencesDeviceIdStore`, `AndroidDeviceInfoProvider`, `LocationSyncWorker`, Compose UI itself) reference `android.*` / `androidx.*` platform APIs, exactly as `src/functions`/`src/adapters` are the thin, untested integration surface on the backend.

Package / applicationId: `com.whereswaldo.android`.

## 4. Design-system contract

A dedicated layer under `ui/designsystem/` is the **only** place styling constants exist. Screens, ViewModels, navigation, and data layers contain **zero** styling — no `Color(...)`, `.dp`, `.sp`, or hardcoded shapes outside `ui/designsystem/token/`.

### 4.1 Token vocabulary (normative names — do not rename without a spec PR)

| Category | Token names | Kotlin type |
|---|---|---|
| Color | `primary, onPrimary, secondary, surface, onSurface, surfaceVariant, danger, onDanger, success, warning, outline` | `androidx.compose.ui.graphics.Color` |
| Type role | `displayLarge, titleLarge, titleMedium, bodyLarge, bodyMedium, labelSmall` | `androidx.compose.ui.text.TextStyle` |
| Spacing | `xs, sm, md, lg, xl, 2xl` | `androidx.compose.ui.unit.Dp` |
| Corner | `sm, md, lg, pill` | `Dp` |
| Elevation | `level0, level1, level2, level3` | `Dp` |

**Kotlin identifier note:** `2xl` is not a legal Kotlin property name (cannot start with a digit). The Kotlin property is named `xxl` and MUST be treated as the same semantic token as `2xl` by any future design-generation tool targeting this contract — documented here once so the mapping is unambiguous.

### 4.2 Default values (placeholder design — fully swappable)

Light:

| Token | Value | Token | Value |
|---|---|---|---|
| `primary` | `#2962FF` | `danger` | `#D32F2F` |
| `onPrimary` | `#FFFFFF` | `onDanger` | `#FFFFFF` |
| `secondary` | `#00897B` | `success` | `#2E7D32` |
| `surface` | `#FFFFFF` | `warning` | `#F9A825` |
| `onSurface` | `#1A1C1E` | `outline` | `#79747E` |
| `surfaceVariant` | `#E7E9EC` | | |

Dark:

| Token | Value | Token | Value |
|---|---|---|---|
| `primary` | `#82B1FF` | `danger` | `#EF5350` |
| `onPrimary` | `#00296B` | `onDanger` | `#601410` |
| `secondary` | `#4DB6AC` | `success` | `#66BB6A` |
| `surface` | `#121316` | `warning` | `#FFD54F` |
| `onSurface` | `#E3E2E6` | `outline` | `#8E9099` |
| `surfaceVariant` | `#44474A` | | |

Typography (same in both themes — only color varies by theme): `displayLarge` 36/44sp regular, `titleLarge` 22/28sp medium, `titleMedium` 16/24sp medium, `bodyLarge` 16/24sp regular, `bodyMedium` 14/20sp regular, `labelSmall` 11/16sp medium.

Spacing (dp): `xs`=4, `sm`=8, `md`=16, `lg`=24, `xl`=32, `2xl`(`xxl`)=48.
Corner (dp): `sm`=4, `md`=8, `lg`=16, `pill`=999.
Elevation (dp): `level0`=0, `level1`=1, `level2`=3, `level3`=6.

### 4.3 Structure

- Tokens are plain `@Immutable data class`es (`WaldoColorTokens`, `WaldoTypographyTokens`, `WaldoSpacingTokens`, `WaldoCornerTokens`, `WaldoElevationTokens`), one light and one dark **color** instance (`LightWaldoColors`, `DarkWaldoColors`); typography/spacing/corner/elevation are theme-invariant singletons.
- `WaldoTheme(darkTheme: Boolean = isSystemInDarkTheme(), content)` provides all five token sets via `staticCompositionLocalOf`, and additionally maps them onto a real Material3 `MaterialTheme` (`ColorScheme`, `Typography`, `Shapes`) so that any un-migrated Material3 primitive still themes correctly during the transition.
- `object WaldoTheme` exposes `WaldoTheme.colors`, `.typography`, `.spacing`, `.corner`, `.elevation` as `@Composable` accessors — the only sanctioned way components read style.
- **Stateless presentational components** in `ui/designsystem/components/`: `WaldoButton`, `WaldoCard`, `WaldoListRow`, `WaldoStatusChip`, `WaldoMapMarkerBubble`, `WaldoTopBar`, `WaldoEmptyState`, `WaldoLoadingState`, `WaldoErrorState`. Each takes plain data (strings, booleans, callbacks) and renders using only `WaldoTheme.*` — never a screen-specific dependency, never a ViewModel reference.
- Screens (`ui/home/HomeScreen.kt` in A1; map/history/etc. in A2) compose these components and are driven by state hoisted from a ViewModel. A `ComponentGalleryPreview.kt` renders every component in both themes side by side, as a visual regression aid for a future design swap.

## 5. Networking layer — endpoint → client mapping

Base URL is configured as `{scheme}://{host}/api/`; every Retrofit method path is `v1/...`, together forming the `/api/v1/...` routes of 001 §1.1. `WaldoApiService` is the raw Retrofit interface; `WaldoApiClient` implements five narrow port interfaces (one per 001 section) and is the only thing the rest of the app depends on — mirrors the backend's ports/adapters split so a future fake for ViewModel tests is trivial.

| 001 § | Method & path | Port interface · method | Request DTO | Response DTO |
|---|---|---|---|---|
| 3.1 | `POST v1/families` | `FamilyApi.createFamily` | `CreateFamilyRequestDto` | `CreateFamilyResponseDto` |
| 3.2 | `GET v1/families/me` | `FamilyApi.getMyFamily` | — | `FamilyMeResponseDto` |
| 3.3 | `POST v1/families/me/invites` | `FamilyApi.createInvite` | `CreateInviteRequestDto` | `CreateInviteResponseDto` |
| 3.4 | `POST v1/invites/accept` | `FamilyApi.acceptInvite` | `AcceptInviteRequestDto` | `AcceptInviteResponseDto` |
| 3.5 | `PATCH v1/families/me/members/{userId}` | `FamilyApi.updateMember` | `UpdateMemberRequestDto` | `MemberDto` |
| 3.6 | `DELETE v1/families/me/members/{userId}` | `FamilyApi.removeMember` | — | `Unit` (bare 204 — no `features`, see §6.3) |
| 4.1 | `POST v1/devices` | `DevicesApi.registerDevice` | `RegisterDeviceRequestDto` | `DeviceDto` |
| 4.2 | `GET v1/devices` | `DevicesApi.listDevices` | — | `ListDevicesResponseDto` |
| 4.3 | `PATCH v1/devices/{deviceId}` | `DevicesApi.updateDevice` | `UpdateDeviceRequestDto` | `DeviceDto` |
| 5.1 | `POST v1/locations` (+`X-Device-Id`) | `LocationsApi.reportLocations` | `ReportLocationsRequestDto` | `ReportLocationsResponseDto` |
| 5.2 | `GET v1/locations/latest` | `LocationsApi.getLatestLocations` | — | `LatestLocationsResponseDto` |
| 5.3 | `GET v1/locations/history` | `LocationsApi.getLocationHistory` | query params | `LocationHistoryResponseDto` |
| 6.1 | `POST v1/locate-requests` | `LocateApi.createLocateRequest` | `CreateLocateRequestRequestDto` | `LocateRequestDto` |
| 6.2 | `GET v1/locate-requests/{id}` | `LocateApi.getLocateRequest` | — | `LocateRequestStatusResponseDto` |
| 6.3 | `POST v1/locate-requests/{id}/fulfill` (+`X-Device-Id`) | `LocateApi.fulfillLocateRequest` | `FulfillLocateRequestRequestDto` | `FulfillResponseDto` |
| 7.1 | `GET v1/geofences` (+`If-None-Match`) | `GeofenceApi.getGeofences` | — | `ETagged<GeofenceConfigResponseDto>?` (`null` on 304, see §6.3) |
| 7.2 | `PUT v1/geofences` (+`If-Match`) | `GeofenceApi.replaceGeofences` | `ReplaceGeofencesRequestDto` | `ETagged<GeofenceConfigResponseDto>` |
| 7.3 | `POST v1/geofence-events` (+`X-Device-Id`) | `GeofenceApi.reportGeofenceEvents` | `ReportGeofenceEventsRequestDto` | `GeofenceEventsResponseDto` |
| 7.4 | `GET v1/geofence-events` | `GeofenceApi.getGeofenceEventHistory` | query params | `GeofenceEventHistoryResponseDto` |

DTOs are `kotlinx.serialization` `@Serializable data class`es whose field names match 001's JSON verbatim (no `@SerialName` needed anywhere). Fields the spec marks optional are nullable with `= null` defaults; fields the spec marks required are non-null. Where 001 documents a field as `null` in a specific state (e.g. 5.2's "no report yet" devices, or history points before any fix — see 5.2/5.3), the DTO makes the whole neighborhood of related fields (`accuracyM`, `batteryPct`, `source`, `receivedAt` alongside the explicitly-called-out `lat/lon/recordedAt/isStale`) nullable too, defensively, per 001 §1.1's forward-compatibility rule ("clients MUST ignore unknown response fields") extended to "clients MUST NOT crash on an absent-but-plausible field".

`X-Device-Id` is attached as an explicit Retrofit `@Header` parameter only on the three methods 001 §1.2 actually requires it on (`reportLocations`, `reportGeofenceEvents`, `fulfillLocateRequest`) — never globally, so the client can't accidentally leak it where the contract doesn't want it.

## 6. Error handling

### 6.1 `ApiError` sealed hierarchy

One subtype per 001 §10 catalog code, plus two client-local variants: `NetworkFailure(cause: Throwable)` (no HTTP response at all — timeout, DNS, offline) and `Unknown(code, message, details, requestId)` (a future/unrecognized code — defensive, should never trigger against a spec-conformant backend). Code-specific `details` are typed where 001 defines a shape: `TrackingPaused.deviceSettings`, `GeofenceVersionConflict.currentEtag`, `ValidationFailed.fields`/`.reason`, `LocationBatchTooLarge.max`, `LimitExceeded.limit`, `RateLimited.retryAfterSeconds`.

`ApiErrorMapper.fromCode(code, message, details, requestId): ApiError` is a pure function (`when (code) { "AUTH_MISSING_TOKEN" -> ...; ...; else -> Unknown(...) }`) covering all 20 catalog codes — the test checklist requires a test that asserts every single code maps to its named subtype (not `Unknown`).

### 6.2 `ApiResult<T>`

```kotlin
sealed class ApiResult<out T> {
    data class Success<T>(val data: T, val features: Features?) : ApiResult<T>()
    data class Failure(val error: ApiError) : ApiResult<Nothing>()
}
```

`features` is nullable **only** to represent 001's two documented body-less successes: §3.6's bare `204` and §7.1's bare `304` (000 overview, "Subscription-ready" bullet). Every other endpoint always carries `Features`.

### 6.3 Envelope parsing & the 204/304 exceptions

- Normal path: Retrofit method returns `Response<Envelope<X>>`; on `isSuccessful`, `WaldoApiClient` unwraps `body.data` + `body.features` into `ApiResult.Success`. On non-2xx, `response.errorBody()` (raw, since Retrofit does not run the success converter on error responses) is decoded as `ErrorEnvelope` and mapped via `ApiErrorMapper`.
- `removeMember` (§3.6): Retrofit method returns `Response<okhttp3.ResponseBody>` (the built-in identity converter — no JSON parsing is attempted on an intentionally-empty 204 body). Success → `ApiResult.Success(Unit, features = null)`.
- `getGeofences` (§7.1): a `304` is not `isSuccessful` (only 200–299 counts) and is handled as a **first-class branch before generic error handling** — `response.code() == 304` → `ApiResult.Success(null, features = null)`; anything else 4xx/5xx still goes through the normal `ApiErrorMapper` path.

### 6.4 Auth-expiry retry

Per 001 §2.1 ("Clients MUST refresh tokens via the Firebase SDK and retry once on `AUTH_TOKEN_EXPIRED`"): every `WaldoApiClient` method, on receiving `ApiError.AuthTokenExpired`, calls `authProvider.currentIdToken(forceRefresh = true)` and retries the exact same call **once**; a second `AuthTokenExpired` is surfaced to the caller as a `Failure`. This is the ID-token concern — see §7 for why it's distinct from push-token refresh.

## 7. Auth (`AuthProvider`)

```kotlin
sealed interface AuthState {
    data object Loading : AuthState
    data object SignedOut : AuthState
    data class SignedIn(val uid: String) : AuthState
}

interface AuthProvider {
    val authState: StateFlow<AuthState>
    suspend fun currentIdToken(forceRefresh: Boolean = false): String?
    suspend fun signOut()
}
```

`AuthInterceptor` (OkHttp) attaches `Authorization: Bearer <token>` from `authProvider.currentIdToken()` on every request (001 §1.2 — required on every endpoint, no anonymous routes).

**`DevAuthProvider`** (dev/stub, used when `BuildConfig.AUTH_MODE == "insecure-local"`): keeps an in-memory signed-in dev user and constructs an **unsigned** JWT-shaped bearer token at runtime — `base64url({"alg":"none"}) + "." + base64url({"iss":.., "aud":.., "sub":<uid>, "iat":.., "exp":..}) + "."` — matching 001 §2.3's "Firebase Auth emulator / hand-crafted JWTs" local-dev shape, so it can be pointed at a real backend running `AUTH_MODE=insecure-local` for manual integration testing. No literal token string is ever embedded in source, tests, or this spec — only the construction code — so nothing here can be mistaken for a real credential by the security-review secret scan.

**`FirebaseAuthProviderStub`**: a placeholder `AuthProvider` for `AUTH_MODE == "firebase"` that throws `NotImplementedError` from every member with a `TODO(H1)` message. It exists only so `AuthProviderFactory`'s `when` is exhaustive today; H1 replaces its body with the real `com.google.firebase:firebase-auth` wiring (no interface change expected).

Firebase Auth ID-token refresh (tokens live ~1 h, 001 §2.1) is handled entirely by §6.4's retry-once path — it is **not** the same mechanism as §8's push-token refresh, a distinction worth stating explicitly since both are "some kind of token refresh" but trigger different client behavior (retry a call vs. re-register a device).

## 8. Device identity & registration

- `DeviceIdProvider.deviceIdFor(uid: String): String` returns a client-generated UUIDv4, persisted per `uid` via `DeviceIdStore` (real: `SharedPreferencesDeviceIdStore`; test: `InMemoryDeviceIdStore`). Per 001 §1.4, a fresh `deviceId` is generated the first time a given `uid` is seen (never reused across a different signed-in user on the same install).
- `DeviceInfoProvider` (interface: `platform`, `model`, `appVersion`; real `AndroidDeviceInfoProvider` reads `Build.MODEL` / `BuildConfig.VERSION_NAME`; fake supplies fixed values for tests) supplies the required §4.1 fields.
- `DeviceRegistrar.registerOrUpdate(pushToken=null, locationPushToken=null)` builds a `RegisterDeviceRequestDto` (omitting absent token fields entirely, matching 001 §4.1's "omitted token fields are left unchanged" pin) and calls `DevicesApi.registerDevice`. Called on: first sign-in, every push-token refresh (§9), and (later, A2) every app update.

## 9. Push-token lifecycle (`PushTokenProvider`)

```kotlin
fun interface PushTokenRefreshListener { fun onNewToken(token: String) }
interface PushTokenProvider {
    suspend fun currentToken(): String?
    fun addRefreshListener(listener: PushTokenRefreshListener)
}
```

`StubPushTokenProvider` is the A1 implementation (no real FCM SDK wired — `google-services.json` is absent per H1-waiver): it never emits a token, documented as a TODO(H1)/TODO(A2) wiring point for `FirebaseMessaging.getInstance()` + a `FirebaseMessagingService.onNewToken` override. The **contract** is fixed now: whatever the real implementation is, `AppContainer` wires its `addRefreshListener` to `deviceRegistrar::onPushTokenRefreshed`, which re-calls `POST /devices` with the new token — satisfying 001 §4.1 / 000 §O4 ("Clients MUST re-`POST /devices` on token refresh") without any future call-site change.

## 10. Offline fix-queue & `batchId` idempotency (001 §5.1)

### 10.1 Model

```kotlin
data class QueuedFix(val fixId: String, val recordedAt: String, val lat: Double, val lon: Double,
                      val accuracyM: Double, val altitudeM: Double?, val speedMps: Double?,
                      val bearingDeg: Double?, val batteryPct: Int, val source: FixSource)
enum class FixSource { PERIODIC, LOCATE, GEOFENCE, MANUAL }
data class FixBatch(val batchId: String, val fixes: List<QueuedFix>)
```

### 10.2 `FixQueueStore` contract

```kotlin
interface FixQueueStore {
    suspend fun enqueue(fix: QueuedFix)
    suspend fun pendingCount(): Int
    suspend fun nextBatch(maxSize: Int = 100): FixBatch?
    suspend fun markBatchAccepted(batchId: String)
    suspend fun markBatchFailedTransient(batchId: String)
    suspend fun markBatchRejected(batchId: String, offendingFixIds: Set<String>)
}
```

Rules encoded (and unit-tested — §14):

1. **Freeze-on-first-ask:** `nextBatch()` assigns a `batchId` to a slice of the oldest ≤`maxSize` pending fixes the first time it's called with nothing already in flight, then **returns the identical `batchId` + fix set** on every subsequent call until that batch is resolved — this is what makes a retried `POST /locations` after a transport failure resend byte-identical content under the same `batchId` (001 §5.1: "retries after transport failures or 5xx MUST resend identical content under the same `batchId`").
2. **Accept:** `markBatchAccepted(batchId)` removes exactly those fixes from the pending pool, permanently — used for any `2xx` response regardless of the `accepted`/`duplicates` split (a replayed-and-deduped batch is still a `200`, i.e. still "resolved" from the queue's point of view).
3. **Transient failure:** `markBatchFailedTransient(batchId)` is a no-op on the pending pool — the batch stays frozen for an identical retry (network error, 5xx).
4. **Definitive rejection:** `markBatchRejected(batchId, offendingFixIds)` drops only the named offenders (parsed from `details.fields` paths like `"fixes[3].recordedAt"`, §15) and un-freezes the rest, which get folded into a **new** batch (new `batchId`) on the next `nextBatch()` call — matching 001 §5.1: "no marker was written — the batch is dead... resubmit the remainder under a new `batchId`".
5. **New fixes never join an in-flight batch:** `enqueue()` while a batch is frozen appends to the pending pool but is excluded from the current `FixBatch.fixes` until the in-flight batch resolves.
6. **Size cap:** `nextBatch(maxSize = 100)` never returns more than `maxSize` fixes (001 §5.1: ">100 → `LOCATION_BATCH_TOO_LARGE`"), splitting a larger backlog across successive calls; an empty pool returns `null` (never an empty-array batch — 001: "empty → `VALIDATION_FAILED`").

### 10.3 `LocationSyncCoordinator`

Ties `FixQueueStore` + `LocationsApi` together: `syncOnce()` calls `nextBatch()`, maps `QueuedFix → LocationFixDto`, calls `reportLocations`, and on the result: `Success` → `markBatchAccepted`; `Failure(NetworkFailure | InternalError | ...5xx-shaped)` → `markBatchFailedTransient`; `Failure(ValidationFailed(fields))` → parses the `fixes[N]` index out of each field path, maps to `fixId`, calls `markBatchRejected`; `Failure(TrackingPaused(deviceSettings))` → returns a `Paused` outcome (caller stops the periodic worker per 001 §5.1, does not touch the queue — those fixes stay queued for after resume).

### 10.4 Persistence — explicit deferral

The task allows "Room or an abstraction." **A1 ships the abstraction (`FixQueueStore`) plus an in-memory implementation (`InMemoryFixQueueStore`)**, not a Room-backed one, for one concrete reason: this sandbox has no Android/Gradle toolchain to compile-check a Room + KSP annotation-processing setup (§13.4), and an unverifiable `@Entity`/`@Dao`/KSP-version pairing is a worse risk than an honestly-scoped in-memory placeholder behind the exact interface a persistent implementation will later satisfy with zero call-site changes. This is a deliberate, documented scope decision, not an oversight — flagged again in the final task report.

### 10.5 Periodic worker — scaffold only

`queue/worker/LocationSyncWorker` (a `CoroutineWorker` skeleton) and `LocationSyncScheduler` (holds the WorkManager periodic-request-building TODO) exist as untested Android-framework glue, per the task's explicit allowance ("the periodic worker may be scaffolded with clear runtime TODOs"). All actual sync decision logic lives in the tested `LocationSyncCoordinator` above; the worker's job is only to invoke it on a schedule once WorkManager enqueueing is wired (A2/H1-adjacent).

## 11. Permission & onboarding flow (000 §O2)

Normative for A2's implementation (no permission-request UI ships in A1 beyond declaring manifest permissions):

1. First app run after sign-in: request `ACCESS_FINE_LOCATION` (foreground) with a rationale screen shown first if the OS requests it.
2. If granted, and the device's configured `syncIntervalMinutes` requires background reporting, request `ACCESS_BACKGROUND_LOCATION` as a **separate, later** request (Android 11+ forbids bundling foreground+background in one dialog) — shown only after a dedicated rationale explaining family-tracking background use (Play policy prep, `mobile/android/README.md`).
3. `syncIntervalMinutes` ∈ {5, 10} (000 §O2) additionally requires the persistent-notification foreground service; ≥15 uses WorkManager periodic work — this determines which permission/consent path §2 above continues into, but the actual foreground-service implementation is A2.
4. `POST_NOTIFICATIONS` (API 33+) is requested independently, for geofence/locate push alerts.
5. **Denial handling:** `ACCESS_FINE_LOCATION` denied → app still shows the family map (open system, others' locations unaffected) but this device cannot report; `ACCESS_BACKGROUND_LOCATION` denied → falls back to foreground-only reporting (only while the app is open) with a persistent in-app banner; the rationale flow is re-enterable from device settings (A2 screen).

## 12. Navigation & proof screen

`Destinations` lists route string constants: `Home` (implemented) and reserved-but-unbuilt constants for A2 (`Map`, `History`, `Geofences`, `Locate`, `Settings` — string values only, no composables, so nothing here can be mistaken for a half-built feature screen). `WaldoNavHost` wires a `NavController` + single `composable(Destinations.Home.route)` today.

**Proof screen — Home:** shows `AuthState` (`Loading` / `SignedOut` with a dev sign-in `WaldoButton` / `SignedIn` with a `WaldoStatusChip` reflecting device-registration outcome) built entirely from `ui/designsystem` components, state hoisted from `HomeStateHolder` (pure, constructor-injected `AuthProvider`/`DeviceRegistrar`, exposes `StateFlow<HomeUiState>`) via the thin `HomeViewModel : ViewModel()` wrapper. `HomeScreenLightPreview`/`HomeScreenDarkPreview` render it under `WaldoTheme(darkTheme = false/true)`.

## 13. Configuration & H1-dependent stubs

- `AppConfig` (typed wrapper over `BuildConfig` fields `BASE_URL`, `AUTH_MODE`, `FIREBASE_PROJECT_ID`): debug build points `BASE_URL` at `http://10.0.2.2:7071/api/` (the Android emulator's documented loopback alias to the host machine, where `func start` listens locally — not a third-party URL) with `AUTH_MODE=insecure-local`; release build points at an obviously-fake placeholder (`https://CHANGE-ME.azurewebsites.net/api/`) with `AUTH_MODE=firebase`, both marked `TODO(H1)` for the real Function App URL / Firebase project ID.
- `google-services.json` stays absent and gitignored (already covered by `mobile/android/.gitignore`) — H1 supplies the real file, at which point the `FirebaseAuthProviderStub` (§7) and `StubPushTokenProvider` (§9) get real bodies and the `com.google.firebase:firebase-auth` / `firebase-messaging` + `com.google.gms.google-services` Gradle plugin get added; **no interface changes are expected**.
- No keystores, service-account keys, or other secrets exist in this task's diff.

## 14. Testing strategy

Plain JUnit4, JVM-only, no Robolectric, no emulator, no instrumented tests — everything under `app/src/test/`. Networking tests use `okhttp3.mockwebserver.MockWebServer` (a real local JVM socket server — exercises the actual Retrofit/OkHttp/kotlinx.serialization stack without any Android dependency, not a hand-mocked substitute). ViewModel logic is tested by constructing `HomeStateHolder` directly with a `TestScope`/`StandardTestDispatcher` and fakes — the thin `HomeViewModel` Android wrapper itself is not separately tested (nothing to test beyond delegation). Deliberately **not** tested in A1 (no toolchain to run them, and/or genuinely deferred): Compose UI rendering/screenshot tests, `LocationSyncWorker`'s real WorkManager scheduling, Room (not present — §10.4).

Every test in this task's diff was written and read for correctness but **not executed** — no Gradle/JDK/Android SDK toolchain exists in this sandbox. CI (`.github/workflows/android.yml`, still a structure-check stub) must run them for real before this is considered green.

## 15. Error cases

Client-side error handling per 001 §10, all driven through `ApiErrorMapper` (§6.1) — no code is invented, all 20 catalog codes are represented as named `ApiError` subtypes. `AUTH_TOKEN_EXPIRED` triggers the retry-once path (§6.4); all other errors surface to the caller as `ApiResult.Failure` for the ViewModel layer to render (rendering itself is A2). `VALIDATION_FAILED` on `POST /locations` additionally drives the fix-queue's rejection path (§10.3) by parsing `details.fields` entries of the shape `"fixes[<index>].<prop>"` to identify offending `fixId`s.

## 16. Test checklist

- Envelope: success unwraps `data`+`features`; `removeMember` yields `Success(Unit, features = null)`; `getGeofences` 304 yields `Success(null, features = null)`; error unwraps into the matching `ApiError` subtype with `requestId` preserved.
- Errors: **every** 001 §10 code (all 20) maps to its named `ApiError` subtype, not `Unknown`; code-specific `details` (fields/reason/limit/currentEtag/deviceSettings/retryAfterSeconds/max) decode correctly.
- Auth-retry: a call receiving `AUTH_TOKEN_EXPIRED` triggers exactly one `currentIdToken(forceRefresh = true)` and one retry; a second expiry surfaces as `Failure`.
- Device registration: request omits absent `pushToken`/`locationPushToken`; `deviceId` is a stable UUIDv4 per uid from `DeviceIdProvider`; a push-token refresh triggers exactly one `registerOrUpdate` call carrying the new token.
- Fix-queue: `nextBatch()` idempotent (same `batchId`+fixes) until resolved; `markBatchAccepted` removes exactly the acked fixes; `markBatchRejected` drops only named offenders and the remainder gets a fresh `batchId` on the next call; `markBatchFailedTransient` changes nothing (retry-safe); new `enqueue()` during an in-flight batch never joins it; `maxSize` cap is respected; empty pool → `null`, never an empty batch.
- `LocationSyncCoordinator`: success/transient-failure/rejection/paused outcomes each drive the correct `FixQueueStore` call.
- `HomeStateHolder`: `Loading → SignedOut` when unauthenticated; `Loading → SignedIn` + successful registration state; registration failure surfaces an error state without crashing the state machine.
- Design system: every component file reads only `WaldoTheme.*` (reviewer spot-check — no automated enforcement in A1).

## Open questions

None — this spec resolves every Android-client concern needed to start A1; unresolved platform-delivery risk stays tracked in 000 §Open Items (O1–O4 as referenced above).
