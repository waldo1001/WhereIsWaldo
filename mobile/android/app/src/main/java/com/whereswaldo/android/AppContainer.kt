package com.whereswaldo.android

import android.content.Context
import com.whereswaldo.android.auth.AuthProvider
import com.whereswaldo.android.auth.AuthProviderFactory
import com.whereswaldo.android.auth.AuthState
import com.whereswaldo.android.config.AppConfig
import com.whereswaldo.android.device.AndroidDeviceInfoProvider
import com.whereswaldo.android.device.DeviceIdProvider
import com.whereswaldo.android.device.DeviceRegistrar
import com.whereswaldo.android.device.SharedPreferencesDeviceIdStore
import com.whereswaldo.android.network.RetrofitFactory
import com.whereswaldo.android.network.WaldoApiClient
import com.whereswaldo.android.push.PushTokenProvider
import com.whereswaldo.android.push.StubPushTokenProvider
import com.whereswaldo.android.queue.FixQueueStore
import com.whereswaldo.android.queue.InMemoryFixQueueStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Manual, poor-man's DI container (specs/003-android-client.md §3) — no Hilt/Dagger, to keep the
 * A1 foundation's build surface small and avoid an unverifiable KSP/annotation-processor
 * version pairing with no toolchain here to compile-check it (same rationale as skipping Room,
 * §10.4). Thin, untested wiring — mirrors the backend's `src/functions`
 * (backend/README.md's hexagonal split).
 */
class AppContainer(context: Context) {

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val appConfig: AppConfig = AppConfig.fromBuildConfig(
        baseUrl = BuildConfig.BASE_URL,
        authModeValue = BuildConfig.AUTH_MODE,
        firebaseProjectId = BuildConfig.FIREBASE_PROJECT_ID,
    )

    val authProvider: AuthProvider =
        AuthProviderFactory.create(appConfig.authMode, appConfig.firebaseProjectId)

    val pushTokenProvider: PushTokenProvider = StubPushTokenProvider()

    private val waldoApiService = RetrofitFactory.create(appConfig.baseUrl, authProvider)
    val waldoApiClient: WaldoApiClient = WaldoApiClient(waldoApiService, authProvider)

    private val deviceIdProvider = DeviceIdProvider(SharedPreferencesDeviceIdStore(context))
    private val deviceInfoProvider = AndroidDeviceInfoProvider()
    val deviceRegistrar: DeviceRegistrar =
        DeviceRegistrar(waldoApiClient, deviceIdProvider, deviceInfoProvider)

    /** Offline fix-queue (specs/003 §10) — not yet drained by anything; `LocationSyncWorker`
     * wiring is A2/H1 scope (§10.5). */
    val fixQueueStore: FixQueueStore = InMemoryFixQueueStore()

    init {
        // 001 §4.1 / 000 §O4: re-POST /devices on every push-token refresh. Fixed wiring point
        // regardless of whether pushTokenProvider is the A1 stub or a real FCM-backed class.
        pushTokenProvider.addRefreshListener { token ->
            val uid = (authProvider.authState.value as? AuthState.SignedIn)?.uid
            if (uid != null) {
                applicationScope.launch {
                    // TODO(A2): surface failures via a retry/backoff policy instead of
                    // fire-and-forget.
                    deviceRegistrar.onPushTokenRefreshed(uid, token)
                }
            }
        }
    }
}
