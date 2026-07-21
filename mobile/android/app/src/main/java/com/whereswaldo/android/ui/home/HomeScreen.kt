package com.whereswaldo.android.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.whereswaldo.android.ui.designsystem.WaldoTheme
import com.whereswaldo.android.ui.designsystem.components.WaldoButton
import com.whereswaldo.android.ui.designsystem.components.WaldoButtonStyle
import com.whereswaldo.android.ui.designsystem.components.WaldoEmptyState
import com.whereswaldo.android.ui.designsystem.components.WaldoErrorState
import com.whereswaldo.android.ui.designsystem.components.WaldoLoadingState
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusChip
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusTone
import com.whereswaldo.android.ui.designsystem.components.WaldoTopBar
import com.whereswaldo.android.ui.nav.Destinations

/**
 * The A1 proof screen (specs/003-android-client.md §12): rendered entirely through
 * `ui/designsystem` components, driven by state hoisted from [HomeViewModel]/[HomeStateHolder].
 * No styling constant appears in this file — only [WaldoTheme]-derived component calls.
 *
 * A2 addition: once registered, a short quick-nav list of [WaldoButton]s reaches the feature
 * screens A1 only reserved route names for ([Destinations]) — this app has no bottom-nav/drawer
 * design-system component yet, so this is the minimal reachability wiring rather than a proper
 * navigation shell; a future design pass can replace it without touching any screen beneath it.
 */
@Composable
fun HomeRoute(
    viewModel: HomeViewModel,
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier,
    onNavigate: (route: String) -> Unit = {},
) {
    val state by viewModel.state.collectAsState()
    HomeScreen(state = state, onSignIn = onSignIn, onNavigate = onNavigate, modifier = modifier)
}

@Composable
fun HomeScreen(
    state: HomeUiState,
    modifier: Modifier = Modifier,
    onSignIn: () -> Unit = {},
    onNavigate: (route: String) -> Unit = {},
) {
    Column(modifier = modifier.fillMaxSize()) {
        WaldoTopBar(title = "Where's waldo")

        Column(
            modifier = Modifier.padding(WaldoTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm),
        ) {
            when (state) {
                is HomeUiState.Loading -> WaldoLoadingState(message = "Loading…")

                is HomeUiState.SignedOut -> {
                    WaldoEmptyState(
                        title = "Not signed in",
                        message = "Sign in to see your family's locations.",
                    )
                    WaldoButton(text = "Sign in", onClick = onSignIn)
                }

                is HomeUiState.SignedIn -> {
                    val (label, tone) = when (state.registration) {
                        HomeUiState.RegistrationStatus.Registering ->
                            "Registering device…" to WaldoStatusTone.Neutral
                        HomeUiState.RegistrationStatus.Registered ->
                            "Device registered" to WaldoStatusTone.Success
                        HomeUiState.RegistrationStatus.Failed ->
                            "Registration failed" to WaldoStatusTone.Danger
                    }
                    WaldoStatusChip(label = label, tone = tone)
                    if (state.registration == HomeUiState.RegistrationStatus.Failed) {
                        WaldoErrorState(
                            title = "Couldn't register this device",
                            message = "Check your connection and try again.",
                        )
                    }
                    if (state.registration != HomeUiState.RegistrationStatus.Registering) {
                        WaldoButton(text = "Family map", onClick = { onNavigate(Destinations.Map.route) }, style = WaldoButtonStyle.Secondary)
                        WaldoButton(text = "History", onClick = { onNavigate(Destinations.History.route) }, style = WaldoButtonStyle.Secondary)
                        WaldoButton(text = "Geofences", onClick = { onNavigate(Destinations.Geofences.route) }, style = WaldoButtonStyle.Secondary)
                        WaldoButton(text = "Settings", onClick = { onNavigate(Destinations.Settings.route) }, style = WaldoButtonStyle.Secondary)
                        WaldoButton(text = "Invites", onClick = { onNavigate(Destinations.Invites.route) }, style = WaldoButtonStyle.Secondary)
                        // A5 addition (specs/005-temporary-groups.md, specs/003 §12.2): works
                        // without a family (§1.5.4) — the one destination that's never a dead
                        // end for a family-less signed-in user, unlike every button above.
                        WaldoButton(text = "Groups", onClick = { onNavigate(Destinations.Groups.route) }, style = WaldoButtonStyle.Secondary)
                    }
                }
            }
        }
    }
}

@Preview(name = "Home — light", showBackground = true)
@Composable
private fun HomeScreenLightPreview() {
    WaldoTheme(darkTheme = false) {
        HomeScreen(state = HomeUiState.SignedIn("uid-preview", HomeUiState.RegistrationStatus.Registered))
    }
}

@Preview(name = "Home — dark", showBackground = true)
@Composable
private fun HomeScreenDarkPreview() {
    WaldoTheme(darkTheme = true) {
        HomeScreen(state = HomeUiState.SignedOut)
    }
}
