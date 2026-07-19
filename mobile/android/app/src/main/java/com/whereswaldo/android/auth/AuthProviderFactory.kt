package com.whereswaldo.android.auth

/** Mirrors `BuildConfig.AUTH_MODE`'s two legal values (specs/003-android-client.md §13). */
enum class AuthMode {
    InsecureLocal,
    Firebase,
    ;

    companion object {
        fun fromBuildConfigValue(value: String): AuthMode = when (value) {
            "insecure-local" -> InsecureLocal
            "firebase" -> Firebase
            else -> error("Unknown AUTH_MODE '$value' (expected 'insecure-local' or 'firebase')")
        }
    }
}

/** Picks the [AuthProvider] implementation for the current build (specs/003 §7, §13). */
object AuthProviderFactory {
    fun create(mode: AuthMode, firebaseProjectId: String): AuthProvider = when (mode) {
        AuthMode.InsecureLocal -> DevAuthProvider(firebaseProjectId = firebaseProjectId)
        AuthMode.Firebase -> FirebaseAuthProviderStub()
    }
}
