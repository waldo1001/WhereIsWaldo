package com.whereswaldo.android.ui.signin

import com.whereswaldo.android.auth.AuthSignInException
import com.whereswaldo.android.auth.AuthState
import com.whereswaldo.android.fakes.FakeAuthProvider
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** [SignInStateHolder] is pure Kotlin — tested with [FakeAuthProvider] (specs/003-android-
 * client.md §7, §14). */
class SignInStateHolderTest {

    @Test
    fun `initial state is Idle`() {
        val holder = SignInStateHolder(FakeAuthProvider(initialState = AuthState.SignedOut))

        assertEquals(SignInUiState.Idle, holder.state.value)
    }

    @Test
    fun `signIn success clears back to Idle and the authProvider observes SignedIn`() = runTest {
        val authProvider = FakeAuthProvider(initialState = AuthState.SignedOut)
        val holder = SignInStateHolder(authProvider)

        holder.signIn("eric@example.com", "hunter2")

        assertEquals(SignInUiState.Idle, holder.state.value)
        assertEquals(listOf("eric@example.com" to "hunter2"), authProvider.signInCalls)
        assertTrue(authProvider.authState.value is AuthState.SignedIn)
    }

    @Test
    fun `signIn failure surfaces the AuthSignInException's user-facing message`() = runTest {
        val authProvider = FakeAuthProvider(initialState = AuthState.SignedOut).apply {
            signInResult = Result.failure(AuthSignInException("Incorrect email or password."))
        }
        val holder = SignInStateHolder(authProvider)

        holder.signIn("eric@example.com", "wrong")

        assertEquals(SignInUiState.Error("Incorrect email or password."), holder.state.value)
    }

    @Test
    fun `blank email is rejected client-side without calling the authProvider`() = runTest {
        val authProvider = FakeAuthProvider(initialState = AuthState.SignedOut)
        val holder = SignInStateHolder(authProvider)

        holder.signIn("", "hunter2")

        assertTrue(holder.state.value is SignInUiState.Error)
        assertEquals(0, authProvider.signInCalls.size)
    }

    @Test
    fun `blank password is rejected client-side without calling the authProvider`() = runTest {
        val authProvider = FakeAuthProvider(initialState = AuthState.SignedOut)
        val holder = SignInStateHolder(authProvider)

        holder.signIn("eric@example.com", "")

        assertTrue(holder.state.value is SignInUiState.Error)
        assertEquals(0, authProvider.signInCalls.size)
    }
}
