package com.whereswaldo.android.ui.groups

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
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
import com.whereswaldo.android.ui.map.MapRenderer

/**
 * The A5 group-map screen (001-api-contract.md §12.10, specs/003-android-client.md §12.2).
 * **Position-only** (specs/005-temporary-groups.md §3): no device chips, no battery — the
 * [GroupMapMemberUi] roster simply has no such fields. Mirrors
 * [com.whereswaldo.android.ui.map.MapScreen]'s structure exactly, through the same [MapRenderer]
 * seam (`RenderGroup`).
 *
 * On `GROUP_EXPIRED` ([GroupMapUiState.Expired]) the screen shows a brief [Toast] and bounces back
 * to the groups list via [onExpired] (specs/003 §12.2: "SHOULD bounce the user back to the groups
 * list with a 'this group has ended' notice") — a plain Android `Toast` rather than a new
 * design-system snackbar component, since no such component exists yet and a `Toast` needs none
 * of `WaldoTheme`'s styling (it's an OS-level surface, not part of this app's UI).
 */
@Composable
fun GroupMapRoute(
    viewModel: GroupMapViewModel,
    mapRenderer: MapRenderer,
    modifier: Modifier = Modifier,
    onExpired: () -> Unit = {},
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(state) {
        val expired = state as? GroupMapUiState.Expired ?: return@LaunchedEffect
        Toast.makeText(context, expired.message, Toast.LENGTH_SHORT).show()
        onExpired()
    }

    GroupMapScreen(state = state, mapRenderer = mapRenderer, onRefresh = viewModel::refresh, modifier = modifier)
}

@Composable
fun GroupMapScreen(
    state: GroupMapUiState,
    mapRenderer: MapRenderer,
    modifier: Modifier = Modifier,
    onRefresh: () -> Unit = {},
) {
    Column(modifier = modifier.fillMaxSize()) {
        WaldoTopBar(
            title = "Group map",
            actions = {
                WaldoButton(text = "Refresh", onClick = onRefresh, style = WaldoButtonStyle.Secondary)
            },
        )

        when (state) {
            is GroupMapUiState.Loading -> WaldoLoadingState(message = "Loading group locations…")

            is GroupMapUiState.Error -> WaldoErrorState(
                title = "Couldn't load the map",
                message = state.message,
                onRetry = onRefresh,
            )

            // Transient — GroupMapRoute's LaunchedEffect is about to navigate away.
            is GroupMapUiState.Expired -> WaldoLoadingState(message = state.message)

            is GroupMapUiState.Content -> {
                if (state.members.isEmpty()) {
                    WaldoEmptyState(title = "No members yet", message = "Share the join code to get this group moving.")
                } else {
                    mapRenderer.RenderGroup(
                        members = state.members,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(WaldoTheme.spacing.md),
                    )

                    LazyColumn(
                        modifier = Modifier.padding(horizontal = WaldoTheme.spacing.md),
                        verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.xs),
                    ) {
                        items(state.members, key = { it.userId }) { member ->
                            WaldoListRow(
                                title = "${member.displayName} (${member.role})",
                                subtitle = if (member.hasLocation) "Updated ${member.recordedAt}" else "No location yet",
                                trailing = {
                                    val (label, tone) = groupMemberStatus(member)
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

private fun groupMemberStatus(member: GroupMapMemberUi): Pair<String, WaldoStatusTone> = when {
    !member.hasLocation -> "No location" to WaldoStatusTone.Neutral
    member.isStale == true -> "Stale" to WaldoStatusTone.Warning
    else -> "Live" to WaldoStatusTone.Success
}

@Preview(name = "Group map — light", showBackground = true)
@Composable
private fun GroupMapScreenLightPreview() {
    WaldoTheme(darkTheme = false) {
        GroupMapScreen(
            state = GroupMapUiState.Content(
                members = listOf(
                    GroupMapMemberUi(
                        userId = "u1",
                        displayName = "Eric",
                        role = "owner",
                        lat = 51.0543,
                        lon = 3.7174,
                        accuracyM = 15.0,
                        recordedAt = "2026-07-21T09:58:00Z",
                        isStale = false,
                    ),
                ),
            ),
            mapRenderer = com.whereswaldo.android.ui.map.PlaceholderMapRenderer(),
        )
    }
}

@Preview(name = "Group map — dark", showBackground = true)
@Composable
private fun GroupMapScreenDarkPreview() {
    WaldoTheme(darkTheme = true) {
        GroupMapScreen(state = GroupMapUiState.Loading, mapRenderer = com.whereswaldo.android.ui.map.PlaceholderMapRenderer())
    }
}
