package com.whereswaldo.android.ui.groups

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.whereswaldo.android.ui.designsystem.WaldoTheme
import com.whereswaldo.android.ui.designsystem.components.WaldoButton
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusChip
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusTone
import com.whereswaldo.android.ui.designsystem.components.WaldoTextField
import com.whereswaldo.android.ui.designsystem.components.WaldoTopBar

/**
 * The A5 join-group screen (001-api-contract.md §12.6, specs/003-android-client.md §12.2): code
 * entry (manual, or prefilled from the `waldo://group-join?code=…` deep link) plus a per-group
 * display name — **always shown** (unlike [CreateGroupScreen]'s conditional field): 005 §1 makes
 * `displayName` the caller's per-group nickname regardless of whether they already have a
 * profile, so it's always meaningful here, merely REQUIRED only when [needsDisplayName] (no
 * profile yet, §1.5.3). The manual code field is deliberately **not** pre-sanitized as the user
 * types — [GroupJoinViewModel.join] runs [GroupJoinCodeSanitizer] on submit either way, so typed
 * and deep-link-prefilled codes go through the identical gate (specs/003 §12.2: "validated by the
 * same pure normalization logic before any network call").
 */
@Composable
fun GroupJoinRoute(
    viewModel: GroupJoinViewModel,
    modifier: Modifier = Modifier,
    prefillCode: String = "",
    onJoined: () -> Unit = {},
) {
    val state by viewModel.state.collectAsState()
    GroupJoinScreen(
        state = state,
        needsDisplayName = viewModel.needsDisplayName,
        prefillCode = prefillCode,
        onJoin = viewModel::join,
        onJoined = onJoined,
        modifier = modifier,
    )
}

@Composable
fun GroupJoinScreen(
    state: GroupJoinUiState,
    modifier: Modifier = Modifier,
    needsDisplayName: Boolean = false,
    prefillCode: String = "",
    onJoin: (code: String, displayName: String?) -> Unit = { _, _ -> },
    onJoined: () -> Unit = {},
) {
    var code by remember { mutableStateOf(prefillCode) }
    var displayName by remember { mutableStateOf("") }

    LaunchedEffect(state.joined) {
        if (state.joined != null) onJoined()
    }

    Column(modifier = modifier.fillMaxSize()) {
        WaldoTopBar(title = "Join a group")

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(WaldoTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm),
        ) {
            WaldoTextField(
                value = code,
                onValueChange = { code = it },
                label = "Group code",
                placeholder = "XXXX-XXXX",
            )

            WaldoTextField(
                value = displayName,
                onValueChange = { displayName = it },
                label = if (needsDisplayName) "Your display name" else "Your display name (optional)",
            )

            state.validationError?.let { WaldoStatusChip(label = it, tone = WaldoStatusTone.Danger) }
            state.joinError?.let { WaldoStatusChip(label = it, tone = WaldoStatusTone.Danger) }

            WaldoButton(
                text = if (state.isJoining) "Joining…" else "Join group",
                enabled = !state.isJoining,
                onClick = { onJoin(code, displayName.ifBlank { null }) },
            )
        }
    }
}

@Preview(name = "Group join — light", showBackground = true)
@Composable
private fun GroupJoinScreenLightPreview() {
    WaldoTheme(darkTheme = false) {
        GroupJoinScreen(state = GroupJoinUiState(), prefillCode = "7F3K9QRZ")
    }
}

@Preview(name = "Group join — dark (error)", showBackground = true)
@Composable
private fun GroupJoinScreenDarkPreview() {
    WaldoTheme(darkTheme = true) {
        GroupJoinScreen(state = GroupJoinUiState(joinError = "That group code isn't valid."), needsDisplayName = true)
    }
}
