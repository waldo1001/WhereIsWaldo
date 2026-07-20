package com.whereswaldo.android.auth

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await

/**
 * The real [AuthProvider] for `BuildConfig.AUTH_MODE == "firebase"` (specs/003-android-client.md
 * §7, H1). Constructor-**injects** [firebaseAuth] rather than calling `FirebaseAuth.getInstance()`
 * itself — that call needs an initialized `FirebaseApp`/Android `Context`, unavailable in this
 * project's plain-JVM unit tests — so this class stays a thin, untested adapter (same category as
 * [com.whereswaldo.android.device.AndroidDeviceInfoProvider]) while [AuthProviderFactory] and its
 * test remain pure-JVM. Only [com.whereswaldo.android.AppContainer] constructs this, with a real
 * `FirebaseAuth.getInstance()`.
 */
class FirebaseAuthProvider(private val firebaseAuth: FirebaseAuth) : AuthProvider {

    private val _authState = MutableStateFlow(mapUser(firebaseAuth.currentUser))
    override val authState: StateFlow<AuthState> = _authState.asStateFlow()

    init {
        // Held for the app process's lifetime (same as everything else in AppContainer) — never
        // removed, there is no matching "dispose" hook for a singleton composition root.
        firebaseAuth.addAuthStateListener { auth -> _authState.value = mapUser(auth.currentUser) }
    }

    private fun mapUser(user: FirebaseUser?): AuthState =
        if (user != null) AuthState.SignedIn(user.uid) else AuthState.SignedOut

    override suspend fun currentIdToken(forceRefresh: Boolean): String? =
        firebaseAuth.currentUser?.getIdToken(forceRefresh)?.await()?.token

    override suspend fun signOut() {
        firebaseAuth.signOut()
    }

    override suspend fun signIn(email: String, password: String) {
        try {
            firebaseAuth.signInWithEmailAndPassword(email, password).await()
        } catch (e: FirebaseAuthInvalidUserException) {
            throw AuthSignInException("No account found for that email.")
        } catch (e: FirebaseAuthInvalidCredentialsException) {
            throw AuthSignInException("Incorrect email or password.")
        } catch (e: Exception) {
            throw AuthSignInException("Couldn't sign in. Check your connection and try again.")
        }
    }
}
