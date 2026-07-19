package com.whereswaldo.android.ui.map

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.whereswaldo.android.ui.designsystem.components.WaldoListRow
import com.whereswaldo.android.ui.designsystem.components.WaldoLoadingState
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusChip
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusTone
import com.whereswaldo.android.ui.designsystem.components.WaldoTopBar

/**
 * The A2 live-map screen (001-api-contract.md §5.2, specs/003-android-client.md §12's `Map`
 * destination). Rendered entirely through `ui/designsystem` components plus the swappable
 * [MapRenderer], driven by state hoisted from [MapViewModel]/[MapStateHolder]. No styling
 * constant appears in this file.
 */
@Composable
fun MapRoute(
    viewModel: MapViewModel,
    mapRenderer: MapRenderer,
    modifier: Modifier = Modifier,
    onSelectMember: (userId: String, displayName: String) -> Unit = { _, _ -> },
) {
    val state by viewModel.state.collectAsState()
    MapScreen(
        state = state,
        mapRenderer = mapRenderer,
        onRefresh = viewModel::refresh,
        onSelectMember = onSelectMember,
        modifier = modifier,
    )
}

@Composable
fun MapScreen(
    state: MapUiState,
    mapRenderer: MapRenderer,
    modifier: Modifier = Modifier,
    onRefresh: () -> Unit = {},
    onSelectMember: (userId: String, displayName: String) -> Unit = { _, _ -> },
) {
    Column(modifier = modifier.fillMaxSize()) {
        WaldoTopBar(
            title = "Family map",
            actions = {
                WaldoButton(text = "Refresh", onClick = onRefresh, style = WaldoButtonStyle.Secondary)
            },
        )

        when (state) {
            is MapUiState.Loading -> WaldoLoadingState(message = "Loading family locations…")

            is MapUiState.Error -> WaldoErrorState(
                title = "Couldn't load the map",
                message = state.message,
                onRetry = onRefresh,
            )

            is MapUiState.Content -> {
                if (state.members.isEmpty()) {
                    WaldoEmptyState(title = "No family yet", message = "Join or create a family to see the map.")
                } else {
                    mapRenderer.Render(
                        members = state.members,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(WaldoTheme.spacing.md),
                    )

                    LazyColumn(
                        modifier = Modifier.padding(horizontal = WaldoTheme.spacing.md),
                        verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.xs),
                    ) {
                        state.members.forEach { member ->
                            if (member.devices.isEmpty()) {
                                item(key = member.userId) {
                                    WaldoListRow(
                                        title = member.displayName,
                                        subtitle = "No devices registered",
                                        onClick = { onSelectMember(member.userId, member.displayName) },
                                    )
                                }
                            } else {
                                items(member.devices, key = { it.deviceId }) { device ->
                                    WaldoListRow(
                                        title = "${member.displayName} · ${device.deviceName}",
                                        subtitle = if (device.hasLocation) {
                                            "Updated ${device.recordedAt}"
                                        } else {
                                            "No location yet"
                                        },
                                        onClick = { onSelectMember(member.userId, member.displayName) },
                                        trailing = {
                                            val (label, tone) = deviceStatus(device)
                                            WaldoStatusChip(label = label, tone = tone)
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun deviceStatus(device: RosterDeviceUi): Pair<String, WaldoStatusTone> = when {
    !device.trackingEnabled -> "Paused" to WaldoStatusTone.Neutral
    !device.hasLocation -> "No location" to WaldoStatusTone.Neutral
    device.isStale == true -> "Stale" to WaldoStatusTone.Warning
    else -> "Live" to WaldoStatusTone.Success
}

@Preview(name = "Map — light", showBackground = true)
@Composable
private fun MapScreenLightPreview() {
    WaldoTheme(darkTheme = false) {
        MapScreen(
            state = MapUiState.Content(
                members = listOf(
                    RosterMemberUi(
                        userId = "u1",
                        displayName = "Eric",
                        devices = listOf(
                            RosterDeviceUi(
                                deviceId = "d1",
                                deviceName = "Pixel 8",
                                lat = 51.0543,
                                lon = 3.7174,
                                recordedAt = "2026-07-19T09:05:12Z",
                                batteryPct = 78,
                                trackingEnabled = true,
                                syncIntervalMinutes = 15,
                                isStale = false,
                            ),
                        ),
                    ),
                ),
            ),
            mapRenderer = PlaceholderMapRenderer(),
        )
    }
}

@Preview(name = "Map — dark", showBackground = true)
@Composable
private fun MapScreenDarkPreview() {
    WaldoTheme(darkTheme = true) {
        MapScreen(state = MapUiState.Loading, mapRenderer = PlaceholderMapRenderer())
    }
}
