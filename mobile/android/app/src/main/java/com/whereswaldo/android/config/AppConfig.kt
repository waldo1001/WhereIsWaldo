package com.whereswaldo.android.config

import com.whereswaldo.android.auth.AuthMode

/**
 * Typed wrapper over `BuildConfig`'s `BASE_URL`/`AUTH_MODE`/`FIREBASE_PROJECT_ID`/`MAPS_API_KEY`
 * fields (specs/003-android-client.md §13). H1 supplies real values once `docs/azure-setup.md`
 * has been run against a real Function App + Firebase project (+ a Google Maps API key, A2's
 * `MapRenderer` seam); nothing here changes when that happens — only the `buildConfigField`
 * values in `app/build.gradle.kts`.
 *
 * @property mapsApiKey empty string until H1 provisions a real key. Sourced from the
 *   `MAPS_API_KEY` Gradle project property (`-PMAPS_API_KEY=…` or `gradle.properties`/
 *   `local.properties`, both gitignored — see `app/build.gradle.kts`'s `mapsApiKey` local val and
 *   `docs/security-review-checklist.md` §5), **never** hardcoded or committed. Blank means "no
 *   real map-tile SDK is configured" — [com.whereswaldo.android.ui.map.PlaceholderMapRenderer] is
 *   used regardless of this value in A2; a future real [com.whereswaldo.android.ui.map.MapRenderer]
 *   would read this to decide whether it can initialize.
 * @property joinLinkHost the public join-link deployment constant (specs/007-public-join-links.md
 *   §1, specs/003-android-client.md §12.3, A6) — `https://{joinLinkHost}/g#{CODE}`. Recorded at
 *   provisioning time (H4); an obviously-fake placeholder (`CHANGE-ME.azurestaticapps.net`) ships
 *   in both build types until then, mirroring `BASE_URL`/`FIREBASE_PROJECT_ID`'s `TODO(H1)`
 *   convention above. Unlike those, debug and release intentionally share one value: the join-link
 *   surface has no dev mode (specs/003 §12.3).
 */
data class AppConfig(
    val baseUrl: String,
    val authMode: AuthMode,
    val firebaseProjectId: String,
    val mapsApiKey: String = "",
    val joinLinkHost: String = "",
) {
    companion object {
        fun fromBuildConfig(
            baseUrl: String,
            authModeValue: String,
            firebaseProjectId: String,
            mapsApiKey: String = "",
            joinLinkHost: String = "",
        ): AppConfig = AppConfig(
            baseUrl = baseUrl,
            authMode = AuthMode.fromBuildConfigValue(authModeValue),
            firebaseProjectId = firebaseProjectId,
            mapsApiKey = mapsApiKey,
            joinLinkHost = joinLinkHost,
        )
    }
}
