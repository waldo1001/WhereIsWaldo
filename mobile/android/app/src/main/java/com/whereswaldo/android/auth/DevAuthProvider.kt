package com.whereswaldo.android.auth

import java.nio.charset.StandardCharsets
import java.util.Base64
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Dev/stub [AuthProvider] (specs/003-android-client.md §7), active when
 * `BuildConfig.AUTH_MODE == "insecure-local"`. Keeps an in-memory signed-in dev user and
 * constructs an **unsigned** JWT-shaped bearer token at call time — matching
 * 001-api-contract.md §2.3's "Firebase Auth emulator / hand-crafted JWTs" local-dev shape (the
 * backend's `AUTH_MODE=insecure-local` trusts `sub` as-is, no signature check). No literal token
 * string is embedded anywhere in source or tests — only this construction code — so nothing
 * here can be mistaken for a real credential by a secret scan.
 *
 * `java.util.Base64` (JDK standard library, natively available since API 26 — this project's
 * exact `minSdk`) is used rather than the still-evolving `kotlin.io.encoding.Base64` stdlib API,
 * to avoid any doubt about that API's experimental/stable status at the pinned Kotlin version
 * with no toolchain available here to check.
 *
 * NOT for production use — see [FirebaseAuthProviderStub] for the H1 replacement.
 */
class DevAuthProvider(
    private val firebaseProjectId: String,
    private val clock: () -> Long = { System.currentTimeMillis() / 1000 },
    initialUid: String? = null,
) : AuthProvider {

    private val state = MutableStateFlow<AuthState>(
        if (initialUid != null) AuthState.SignedIn(initialUid) else AuthState.SignedOut,
    )
    override val authState: StateFlow<AuthState> = state.asStateFlow()

    /** Dev-only helper — signs in a fake uid without any real credential exchange. */
    fun signInDev(uid: String) {
        state.value = AuthState.SignedIn(uid)
    }

    override suspend fun currentIdToken(forceRefresh: Boolean): String? {
        val current = state.value
        if (current !is AuthState.SignedIn) return null
        return buildUnsignedJwt(current.uid)
    }

    override suspend fun signOut() {
        state.value = AuthState.SignedOut
    }

    private fun buildUnsignedJwt(uid: String): String {
        val nowSeconds = clock()
        val header = "{\"alg\":\"none\",\"typ\":\"JWT\"}"
        val payload = "{\"iss\":\"https://securetoken.google.com/$firebaseProjectId\"," +
            "\"aud\":\"$firebaseProjectId\",\"sub\":\"$uid\",\"iat\":$nowSeconds,\"exp\":${nowSeconds + 3600}}"
        val encoder = Base64.getUrlEncoder().withoutPadding()
        val encodedHeader = encoder.encodeToString(header.toByteArray(StandardCharsets.UTF_8))
        val encodedPayload = encoder.encodeToString(payload.toByteArray(StandardCharsets.UTF_8))
        // Unsigned: the signature segment is intentionally empty (001 §2.3's "unsigned tokens").
        return "$encodedHeader.$encodedPayload."
    }
}
