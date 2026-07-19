package com.whereswaldo.android.config

import com.whereswaldo.android.auth.AuthMode

/**
 * Typed wrapper over `BuildConfig`'s `BASE_URL`/`AUTH_MODE`/`FIREBASE_PROJECT_ID` fields
 * (specs/003-android-client.md §13). H1 supplies real values once `docs/azure-setup.md` has
 * been run against a real Function App + Firebase project; nothing here changes when that
 * happens — only the `buildConfigField` values in `app/build.gradle.kts`.
 */
data class AppConfig(
    val baseUrl: String,
    val authMode: AuthMode,
    val firebaseProjectId: String,
) {
    companion object {
        fun fromBuildConfig(
            baseUrl: String,
            authModeValue: String,
            firebaseProjectId: String,
        ): AppConfig = AppConfig(
            baseUrl = baseUrl,
            authMode = AuthMode.fromBuildConfigValue(authModeValue),
            firebaseProjectId = firebaseProjectId,
        )
    }
}
