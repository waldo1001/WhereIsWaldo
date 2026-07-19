package com.whereswaldo.android.auth

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Placeholder [AuthProvider] for `BuildConfig.AUTH_MODE == "firebase"`
 * (specs/003-android-client.md §7). H1 replaces every member's body with real
 * `com.google.firebase:firebase-auth` wiring (`FirebaseAuth.getInstance()`, ID token
 * fetch/refresh) once `google-services.json` exists — no interface change is expected. Exists
 * only so [AuthProviderFactory]'s `when` is exhaustive today.
 */
class FirebaseAuthProviderStub : AuthProvider {
    override val authState: StateFlow<AuthState> =
        MutableStateFlow<AuthState>(AuthState.SignedOut).asStateFlow()

    override suspend fun currentIdToken(forceRefresh: Boolean): String? = notImplemented()

    override suspend fun signOut(): Unit = notImplemented()

    private fun notImplemented(): Nothing = throw NotImplementedError(
        "TODO(H1): wire real Firebase Auth once google-services.json exists (specs/003 §7, §13)",
    )
}
