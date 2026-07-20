package com.whereswaldo.android.ui.signin

import com.whereswaldo.android.auth.AuthProvider
import com.whereswaldo.android.auth.AuthSignInException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** The sign-in screen's state (specs/003-android-client.md §7). Deliberately no `Success` case —
 * on a successful [SignInStateHolder.signIn], [AuthProvider.authState] itself transitions to
 * `SignedIn`, which the caller (`WaldoNavHost`) observes directly. */
sealed interface SignInUiState {
    data object Idle : SignInUiState
    data object Submitting : SignInUiState
    data class Error(val message: String) : SignInUiState
}

/**
 * The email/password sign-in screen's pure state machine (specs/003-android-client.md §7). No
 * constructor [kotlinx.coroutines.CoroutineScope] is needed — like
 * [com.whereswaldo.android.ui.invites.InvitesStateHolder] — since sign-in is a user-initiated
 * form, not something to eagerly load.
 */
class SignInStateHolder(private val authProvider: AuthProvider) {

    private val _state = MutableStateFlow<SignInUiState>(SignInUiState.Idle)
    val state: StateFlow<SignInUiState> = _state.asStateFlow()

    suspend fun signIn(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _state.value = SignInUiState.Error("Enter both an email and a password.")
            return
        }
        _state.value = SignInUiState.Submitting
        try {
            authProvider.signIn(email, password)
            _state.value = SignInUiState.Idle
        } catch (e: AuthSignInException) {
            _state.value = SignInUiState.Error(e.message ?: "Couldn't sign in. Try again.")
        }
    }
}
