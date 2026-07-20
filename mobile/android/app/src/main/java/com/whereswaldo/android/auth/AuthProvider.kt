package com.whereswaldo.android.auth

import kotlinx.coroutines.flow.StateFlow

/**
 * Abstraction over the Firebase Auth ID-token source (specs/003-android-client.md §7).
 * [FirebaseAuthProvider] is the real, H1-wired implementation; [DevAuthProvider] is the A1 dev/
 * stub implementation used when `BuildConfig.AUTH_MODE == "insecure-local"`.
 *
 * Pure Kotlin/JVM — no `android.*` import — unit-testable without an emulator.
 */
interface AuthProvider {
    val authState: StateFlow<AuthState>

    /**
     * The current Firebase ID token, or `null` if signed out. [forceRefresh] is used by
     * `network/WaldoApiClient.kt`'s retry-once-on-`AUTH_TOKEN_EXPIRED` path (001-api-contract.md
     * §2.1/§6.4) — it is NOT the push-token refresh mechanism (see `push/PushTokenProvider.kt`
     * and specs/003 §7 for why the two are distinct).
     */
    suspend fun currentIdToken(forceRefresh: Boolean = false): String?

    suspend fun signOut()

    /**
     * Email/password sign-in (specs/003 §7). On success, [authState] transitions to
     * [AuthState.SignedIn] — callers (e.g. `WaldoNavHost`) observe that directly rather than
     * relying on this function's return. Throws [AuthSignInException] on failure.
     */
    suspend fun signIn(email: String, password: String)
}

/**
 * A sign-in failure, already mapped to a user-facing [message] — never the raw Firebase SDK/
 * server text (docs/security-review-checklist.md's "no raw error text" principle, mirrored from
 * `network/ApiErrorUserMessage.kt`).
 */
class AuthSignInException(message: String) : Exception(message)
