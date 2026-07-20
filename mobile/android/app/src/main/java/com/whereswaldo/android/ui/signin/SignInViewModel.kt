package com.whereswaldo.android.ui.signin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.whereswaldo.android.auth.AuthProvider
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/** Thin Android `ViewModel` wrapper — all logic lives in [SignInStateHolder] (specs/003-android-
 * client.md §7, §14; same convention as `InvitesViewModel`). */
class SignInViewModel(authProvider: AuthProvider) : ViewModel() {
    private val stateHolder = SignInStateHolder(authProvider)
    val state: StateFlow<SignInUiState> = stateHolder.state

    fun signIn(email: String, password: String) {
        viewModelScope.launch { stateHolder.signIn(email, password) }
    }
}

/** No DI framework (specs/003 §3) — a plain [ViewModelProvider.Factory]. */
class SignInViewModelFactory(private val authProvider: AuthProvider) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = SignInViewModel(authProvider) as T
}
