package com.whereswaldo.android.ui.signin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import com.whereswaldo.android.ui.designsystem.WaldoTheme
import com.whereswaldo.android.ui.designsystem.components.WaldoButton
import com.whereswaldo.android.ui.designsystem.components.WaldoErrorState
import com.whereswaldo.android.ui.designsystem.components.WaldoTextField
import com.whereswaldo.android.ui.designsystem.components.WaldoTopBar

/**
 * The email/password sign-in screen (specs/003-android-client.md §7), rendered entirely through
 * `ui/designsystem` components, driven by state hoisted from [SignInStateHolder] via
 * [SignInViewModel]. There is no "signed in" branch here — once [SignInStateHolder.signIn]
 * succeeds, `AuthProvider.authState` itself flips to `SignedIn`, which `WaldoNavHost` observes to
 * pop this screen off the back stack.
 */
@Composable
fun SignInRoute(viewModel: SignInViewModel, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsState()
    SignInScreen(state = state, onSignIn = viewModel::signIn, modifier = modifier)
}

@Composable
fun SignInScreen(
    state: SignInUiState,
    modifier: Modifier = Modifier,
    onSignIn: (email: String, password: String) -> Unit = { _, _ -> },
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(modifier = modifier.fillMaxSize()) {
        WaldoTopBar(title = "Sign in")

        Column(
            modifier = Modifier.padding(WaldoTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm),
        ) {
            WaldoTextField(
                value = email,
                onValueChange = { email = it },
                label = "Email",
                placeholder = "you@example.com",
                enabled = state != SignInUiState.Submitting,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            )
            WaldoTextField(
                value = password,
                onValueChange = { password = it },
                label = "Password",
                enabled = state != SignInUiState.Submitting,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                visualTransformation = PasswordVisualTransformation(),
            )

            if (state is SignInUiState.Error) {
                WaldoErrorState(title = "Couldn't sign in", message = state.message)
            }

            WaldoButton(
                text = if (state == SignInUiState.Submitting) "Signing in…" else "Sign in",
                enabled = state != SignInUiState.Submitting,
                onClick = { onSignIn(email, password) },
            )
        }
    }
}

@Preview(name = "Sign in — light", showBackground = true)
@Composable
private fun SignInScreenLightPreview() {
    WaldoTheme(darkTheme = false) {
        SignInScreen(state = SignInUiState.Idle)
    }
}

@Preview(name = "Sign in — dark", showBackground = true)
@Composable
private fun SignInScreenDarkPreview() {
    WaldoTheme(darkTheme = true) {
        SignInScreen(state = SignInUiState.Error("Incorrect email or password."))
    }
}
