package com.whereswaldo.android.ui.locate

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
import com.whereswaldo.android.ui.designsystem.components.WaldoCard
import com.whereswaldo.android.ui.designsystem.components.WaldoEmptyState
import com.whereswaldo.android.ui.designsystem.components.WaldoErrorState
import com.whereswaldo.android.ui.designsystem.components.WaldoListRow
import com.whereswaldo.android.ui.designsystem.components.WaldoLoadingState
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusChip
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusTone
import com.whereswaldo.android.ui.designsystem.components.WaldoTopBar

/**
 * The A2 "locate now" screen (001-api-contract.md §6, specs/003-android-client.md §12's `Locate`
 * destination): a single action that creates a locate request, then polls
 * [LocateViewModel]/[LocateStateHolder] every 2 s until a terminal state
 * (`fulfilled`/`expired`/`pushFailed`) is reached, rendering `lastKnown` immediately as the
 * instant answer.
 */
@Composable
fun LocateRoute(
    viewModel: LocateViewModel,
    targetUserId: String,
    targetDisplayName: String,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsState()
    LocateScreen(
        state = state,
        targetDisplayName = targetDisplayName,
        onLocateNow = { viewModel.requestLocate(targetUserId = targetUserId) },
        modifier = modifier,
    )
}

@Composable
fun LocateScreen(
    state: LocateUiState,
    modifier: Modifier = Modifier,
    targetDisplayName: String = "",
    onLocateNow: () -> Unit = {},
) {
    Column(modifier = modifier.fillMaxSize()) {
        WaldoTopBar(title = "Locate $targetDisplayName")

        Column(
            modifier = Modifier.padding(WaldoTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.md),
        ) {
            when (state) {
                is LocateUiState.Idle -> {
                    WaldoEmptyState(title = "Locate $targetDisplayName", message = "Get their current location now.")
                    WaldoButton(text = "Locate now", onClick = onLocateNow)
                }

                is LocateUiState.Error -> WaldoErrorState(
                    title = "Couldn't request a location",
                    message = state.message,
                    onRetry = onLocateNow,
                )

                is LocateUiState.Polling -> {
                    WaldoStatusChip(label = "Waiting for a response…", tone = WaldoStatusTone.Neutral)
                    state.lastKnown?.let { lastKnown ->
                        WaldoCard {
                            WaldoListRow(
                                title = "Last known",
                                subtitle = "${lastKnown.lat}, ${lastKnown.lon} · ${lastKnown.recordedAt}",
                            )
                        }
                    }
                    WaldoLoadingState(message = "Polling…")
                }

                is LocateUiState.Terminal -> {
                    val (label, tone) = when (state.status) {
                        "fulfilled" -> "Located" to WaldoStatusTone.Success
                        "pushFailed" -> "Couldn't reach the device — showing last known" to WaldoStatusTone.Warning
                        else -> "Request expired" to WaldoStatusTone.Neutral
                    }
                    WaldoStatusChip(label = label, tone = tone)

                    val point = state.fix?.let { it.lat to it.lon } ?: state.lastKnown?.let { it.lat to it.lon }
                    if (point != null) {
                        WaldoCard {
                            WaldoListRow(
                                title = "Location",
                                subtitle = "${point.first}, ${point.second}",
                            )
                        }
                    }

                    WaldoButton(text = "Locate again", onClick = onLocateNow)
                }
            }
        }
    }
}

@Preview(name = "Locate — light", showBackground = true)
@Composable
private fun LocateScreenLightPreview() {
    WaldoTheme(darkTheme = false) {
        LocateScreen(
            state = LocateUiState.Terminal(
                requestId = "lr_preview",
                status = "fulfilled",
                fix = LocateFixUi("d1", 51.0544, 3.7170, 4.8, "2026-07-19T09:05:12Z", 77),
                lastKnown = null,
            ),
            targetDisplayName = "Noor",
        )
    }
}

@Preview(name = "Locate — dark", showBackground = true)
@Composable
private fun LocateScreenDarkPreview() {
    WaldoTheme(darkTheme = true) {
        LocateScreen(state = LocateUiState.Idle, targetDisplayName = "Noor")
    }
}
