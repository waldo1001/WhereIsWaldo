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
import androidx.compose.ui.tooling.preview.Preview
import com.whereswaldo.android.ui.designsystem.WaldoTheme
import com.whereswaldo.android.ui.designsystem.components.WaldoButton
import com.whereswaldo.android.ui.designsystem.components.WaldoButtonStyle
import com.whereswaldo.android.ui.designsystem.components.WaldoErrorState
import com.whereswaldo.android.ui.designsystem.components.WaldoLoadingState
import com.whereswaldo.android.ui.designsystem.components.WaldoTextField
import com.whereswaldo.android.ui.designsystem.components.WaldoTopBar

/**
 * The phone sign-in screen (specs/006-phone-auth.md §4.1, specs/003-android-client.md §7): one
 * screen, two steps — phone entry, then code entry — rendered entirely through
 * `ui/designsystem` components, driven by state hoisted from [SignInStateHolder] via
 * [SignInViewModel]. There is no "signed in" branch here — once verification/confirmation
 * succeeds, `AuthProvider.authState` itself flips to `SignedIn`, which `WaldoNavHost` observes to
 * pop this screen off the back stack.
 */
@Composable
fun SignInRoute(viewModel: SignInViewModel, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsState()
    SignInScreen(
        state = state,
        onSubmitPhone = viewModel::submitPhone,
        onSubmitCode = viewModel::submitCode,
        onResend = viewModel::resend,
        onChangeNumber = viewModel::changeNumber,
        modifier = modifier,
    )
}

@Composable
fun SignInScreen(
    state: SignInUiState,
    modifier: Modifier = Modifier,
    onSubmitPhone: (String) -> Unit = {},
    onSubmitCode: (String) -> Unit = {},
    onResend: () -> Unit = {},
    onChangeNumber: () -> Unit = {},
) {
    Column(modifier = modifier.fillMaxSize()) {
        WaldoTopBar(title = "Sign in")

        Column(
            modifier = Modifier.padding(WaldoTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm),
        ) {
            when (state) {
                is SignInUiState.EnteringPhone -> {
                    var phone by remember(state) { mutableStateOf(state.phone) }
                    WaldoTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = "Phone number",
                        placeholder = "+32470000000",
                        isError = state.error != null,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    )
                    if (state.error != null) {
                        WaldoErrorState(title = "Couldn't sign in", message = state.error)
                    }
                    WaldoButton(text = "Send code", onClick = { onSubmitPhone(phone) })
                }

                is SignInUiState.SendingCode -> {
                    WaldoLoadingState(message = "Sending code…")
                }

                is SignInUiState.EnteringCode -> {
                    var code by remember(state.phone) { mutableStateOf("") }
                    WaldoTextField(
                        value = code,
                        onValueChange = { code = it },
                        label = "Code sent to ${state.phone}",
                        placeholder = "123456",
                        isError = state.error != null,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    )
                    if (state.error != null) {
                        WaldoErrorState(title = "Couldn't sign in", message = state.error)
                    }
                    WaldoButton(text = "Confirm code", onClick = { onSubmitCode(code) })
                    WaldoButton(
                        text = if (state.resendSecondsLeft > 0) "Resend in ${state.resendSecondsLeft}s" else "Resend code",
                        enabled = state.resendSecondsLeft == 0,
                        style = WaldoButtonStyle.Secondary,
                        onClick = onResend,
                    )
                    WaldoButton(text = "Change number", style = WaldoButtonStyle.Secondary, onClick = onChangeNumber)
                }

                is SignInUiState.ConfirmingCode -> {
                    WaldoLoadingState(message = "Signing in…")
                }
            }
        }
    }
}

@Preview(name = "Sign in — phone entry, light", showBackground = true)
@Composable
private fun SignInScreenPhoneLightPreview() {
    WaldoTheme(darkTheme = false) {
        SignInScreen(state = SignInUiState.EnteringPhone())
    }
}

@Preview(name = "Sign in — code entry, dark", showBackground = true)
@Composable
private fun SignInScreenCodeDarkPreview() {
    WaldoTheme(darkTheme = true) {
        SignInScreen(state = SignInUiState.EnteringCode(phone = "+32470000001", resendSecondsLeft = 12))
    }
}
