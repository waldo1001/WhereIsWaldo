package com.whereswaldo.android.ui.groups

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.whereswaldo.android.ui.designsystem.WaldoTheme
import com.whereswaldo.android.ui.designsystem.components.WaldoButton
import com.whereswaldo.android.ui.designsystem.components.WaldoButtonStyle
import com.whereswaldo.android.ui.designsystem.components.WaldoCard
import com.whereswaldo.android.ui.designsystem.components.WaldoEmptyState
import com.whereswaldo.android.ui.designsystem.components.WaldoErrorState
import com.whereswaldo.android.ui.designsystem.components.WaldoLoadingState
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusChip
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusTone
import com.whereswaldo.android.ui.designsystem.components.WaldoTopBar
import java.time.Instant

/**
 * The A5 groups list screen (001-api-contract.md §12.2, specs/003-android-client.md §12.2):
 * every group the caller belongs to, plus entry points to create/join one. Doubles as the
 * **family-less home** — a signed-in user with no family (§1.5.4) is no longer a dead end here,
 * unlike every family-scoped A2 screen; [onManageFamily] routes to the existing `Invites` screen
 * (§3.4's join-a-family flow — the only family-creation/-join UI this app has today).
 *
 * The `LaunchedEffect(Unit) { viewModel.refresh() }` re-fetches every time this composable
 * re-enters composition (returning from `GroupCreate`/`GroupJoin`/`GroupDetail`/`GroupMap`, all of
 * which pop back to this destination) — the "list re-load then reflects the true state"
 * specs/003 §12.2 requires after a create/join or a `GROUP_EXPIRED` bounce-back. The underlying
 * [GroupsListViewModel] (and its `GroupsListStateHolder`) survives across that pop, scoped to the
 * nav back-stack entry, so this is a genuine re-fetch, not a fresh `StateHolder` re-`init`.
 */
@Composable
fun GroupsListRoute(
    viewModel: GroupsListViewModel,
    modifier: Modifier = Modifier,
    onCreateGroup: (GroupsListUiState.Content) -> Unit = {},
    onJoinGroup: (GroupsListUiState.Content) -> Unit = {},
    onOpenGroup: (groupId: String) -> Unit = {},
    onManageFamily: () -> Unit = {},
) {
    val state by viewModel.state.collectAsState()
    LaunchedEffect(Unit) { viewModel.refresh() }
    GroupsListScreen(
        state = state,
        onRefresh = viewModel::refresh,
        onCreateGroup = onCreateGroup,
        onJoinGroup = onJoinGroup,
        onOpenGroup = onOpenGroup,
        onManageFamily = onManageFamily,
        modifier = modifier,
    )
}

@Composable
fun GroupsListScreen(
    state: GroupsListUiState,
    modifier: Modifier = Modifier,
    onRefresh: () -> Unit = {},
    onCreateGroup: (GroupsListUiState.Content) -> Unit = {},
    onJoinGroup: (GroupsListUiState.Content) -> Unit = {},
    onOpenGroup: (groupId: String) -> Unit = {},
    onManageFamily: () -> Unit = {},
) {
    Column(modifier = modifier.fillMaxSize()) {
        WaldoTopBar(
            title = "Groups",
            actions = {
                WaldoButton(text = "Refresh", onClick = onRefresh, style = WaldoButtonStyle.Secondary)
            },
        )

        when (state) {
            is GroupsListUiState.Loading -> WaldoLoadingState(message = "Loading groups…")

            is GroupsListUiState.Error -> WaldoErrorState(
                title = "Couldn't load groups",
                message = state.message,
                onRetry = onRefresh,
            )

            is GroupsListUiState.Content -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(WaldoTheme.spacing.md),
                    verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm),
                ) {
                    if (!state.hasFamily) {
                        WaldoCard {
                            Column(verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.xs)) {
                                WaldoStatusChip(label = "No family yet", tone = WaldoStatusTone.Neutral)
                                WaldoButton(
                                    text = "Manage family invites",
                                    onClick = onManageFamily,
                                    style = WaldoButtonStyle.Secondary,
                                )
                            }
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm)) {
                        WaldoButton(text = "Create group", onClick = { onCreateGroup(state) })
                        WaldoButton(text = "Join group", onClick = { onJoinGroup(state) }, style = WaldoButtonStyle.Secondary)
                    }
                }

                if (state.groups.isEmpty()) {
                    WaldoEmptyState(
                        title = "No groups yet",
                        message = "Create a group or join one with a code to get started.",
                    )
                } else {
                    val now = Instant.now().toString()
                    LazyColumn(
                        modifier = Modifier.padding(horizontal = WaldoTheme.spacing.md),
                        verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm),
                    ) {
                        items(state.groups, key = { it.groupId }) { group ->
                            WaldoCard(modifier = Modifier.fillMaxWidth()) {
                                Column(verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.xs)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm)) {
                                        val (label, tone) = groupStateStatus(group.state)
                                        WaldoStatusChip(label = label, tone = tone)
                                        WaldoStatusChip(
                                            label = GroupCountdownFormatter.format(group.endsAt, now),
                                            tone = WaldoStatusTone.Neutral,
                                        )
                                    }
                                    WaldoButton(
                                        text = "${group.name} · ${group.memberCount} member${if (group.memberCount == 1) "" else "s"}",
                                        onClick = { onOpenGroup(group.groupId) },
                                        style = WaldoButtonStyle.Secondary,
                                        modifier = Modifier.fillMaxWidth(),
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

private fun groupStateStatus(state: String): Pair<String, WaldoStatusTone> = when (state) {
    "active" -> "Active" to WaldoStatusTone.Success
    "ended" -> "Ended (grace)" to WaldoStatusTone.Warning
    "archived" -> "Archived" to WaldoStatusTone.Neutral
    else -> state to WaldoStatusTone.Neutral
}

@Preview(name = "Groups — light", showBackground = true)
@Composable
private fun GroupsListScreenLightPreview() {
    WaldoTheme(darkTheme = false) {
        GroupsListScreen(
            state = GroupsListUiState.Content(
                groups = listOf(
                    GroupSummaryUi(
                        groupId = "grp_9J2Kq7Lm3NpR5sTvWxYz",
                        name = "Festival crew",
                        endsAt = "2026-08-02T22:00:00Z",
                        expiryPolicy = "delete",
                        state = "active",
                        role = "owner",
                        memberCount = 7,
                        code = "7F3K9QRZ",
                    ),
                ),
                limits = null,
                hasFamily = true,
                needsDisplayName = false,
            ),
        )
    }
}

@Preview(name = "Groups — dark (family-less, empty)", showBackground = true)
@Composable
private fun GroupsListScreenDarkPreview() {
    WaldoTheme(darkTheme = true) {
        GroupsListScreen(
            state = GroupsListUiState.Content(
                groups = emptyList(),
                limits = null,
                hasFamily = false,
                needsDisplayName = true,
            ),
        )
    }
}
