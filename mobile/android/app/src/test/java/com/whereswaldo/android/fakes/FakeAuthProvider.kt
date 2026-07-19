package com.whereswaldo.android.fakes

import com.whereswaldo.android.auth.AuthProvider
import com.whereswaldo.android.auth.AuthState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Test fake — mirrors the backend's `test/fakes/` convention (backend/README.md). */
class FakeAuthProvider(
    initialToken: String? = "fake-token",
    initialState: AuthState = AuthState.SignedIn("uid-test"),
) : AuthProvider {

    private val state = MutableStateFlow(initialState)
    override val authState: StateFlow<AuthState> = state

    var currentToken: String? = initialToken

    /** Set before a test to simulate what a forced refresh yields. */
    var tokenAfterRefresh: String? = null

    var forceRefreshCallCount = 0
        private set

    override suspend fun currentIdToken(forceRefresh: Boolean): String? {
        if (forceRefresh) {
            forceRefreshCallCount++
            tokenAfterRefresh?.let { currentToken = it }
        }
        return currentToken
    }

    override suspend fun signOut() {
        state.value = AuthState.SignedOut
    }
}
