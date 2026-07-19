package com.whereswaldo.android.ui.invites

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.whereswaldo.android.ui.designsystem.WaldoTheme
import com.whereswaldo.android.ui.designsystem.components.WaldoButton
import com.whereswaldo.android.ui.designsystem.components.WaldoButtonStyle
import com.whereswaldo.android.ui.designsystem.components.WaldoCard
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusChip
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusTone
import com.whereswaldo.android.ui.designsystem.components.WaldoTextField
import com.whereswaldo.android.ui.designsystem.components.WaldoTopBar

/**
 * The A2 invites screen (001-api-contract.md §3.3/§3.4, specs/003-android-client.md §12): create
 * an invite (parent, shared out-of-band per §3.3) and accept an invite (join a family, §3.4) —
 * two independent forms on one screen, driven by [InvitesViewModel]/[InvitesStateHolder].
 */
@Composable
fun InvitesRoute(viewModel: InvitesViewModel, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsState()
    InvitesScreen(
        state = state,
        onCreateInvite = viewModel::createInvite,
        onAcceptInvite = viewModel::acceptInvite,
        modifier = modifier,
    )
}

@Composable
fun InvitesScreen(
    state: InvitesUiState,
    modifier: Modifier = Modifier,
    onCreateInvite: (role: String, emailHint: String?) -> Unit = { _, _ -> },
    onAcceptInvite: (inviteCode: String, displayName: String) -> Unit = { _, _ -> },
) {
    var selectedRole by remember { mutableStateOf("member") }
    var emailHint by remember { mutableStateOf("") }
    var inviteCode by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }

    Column(modifier = modifier.fillMaxSize()) {
        WaldoTopBar(title = "Invites")

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(WaldoTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.lg),
        ) {
            WaldoCard {
                Column(verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm)) {
                        WaldoButton(
                            text = "Member",
                            onClick = { selectedRole = "member" },
                            style = if (selectedRole == "member") WaldoButtonStyle.Primary else WaldoButtonStyle.Secondary,
                        )
                        WaldoButton(
                            text = "Parent",
                            onClick = { selectedRole = "parent" },
                            style = if (selectedRole == "parent") WaldoButtonStyle.Primary else WaldoButtonStyle.Secondary,
                        )
                    }
                    WaldoTextField(value = emailHint, onValueChange = { emailHint = it }, label = "Email hint (optional)")
                    WaldoButton(
                        text = if (state.isCreatingInvite) "Creating…" else "Create invite",
                        enabled = !state.isCreatingInvite,
                        onClick = { onCreateInvite(selectedRole, emailHint.ifBlank { null }) },
                    )
                    state.createdInvite?.let { invite ->
                        WaldoStatusChip(label = "Code: ${invite.inviteCode} · expires ${invite.expiresAt}", tone = WaldoStatusTone.Success)
                    }
                    state.createInviteError?.let { error ->
                        WaldoStatusChip(label = error, tone = WaldoStatusTone.Danger)
                    }
                }
            }

            WaldoCard {
                Column(verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm)) {
                    WaldoTextField(value = inviteCode, onValueChange = { inviteCode = it }, label = "Invite code")
                    WaldoTextField(value = displayName, onValueChange = { displayName = it }, label = "Your display name")
                    WaldoButton(
                        text = if (state.isAcceptingInvite) "Joining…" else "Join family",
                        enabled = !state.isAcceptingInvite && inviteCode.isNotBlank() && displayName.isNotBlank(),
                        onClick = { onAcceptInvite(inviteCode, displayName) },
                    )
                    state.acceptedFamily?.let { family ->
                        WaldoStatusChip(label = "Joined ${family.familyName} as ${family.role}", tone = WaldoStatusTone.Success)
                    }
                    state.acceptInviteError?.let { error ->
                        WaldoStatusChip(label = error, tone = WaldoStatusTone.Danger)
                    }
                }
            }
        }
    }
}

@Preview(name = "Invites — light", showBackground = true)
@Composable
private fun InvitesScreenLightPreview() {
    WaldoTheme(darkTheme = false) {
        InvitesScreen(
            state = InvitesUiState(createdInvite = CreatedInviteUi("7F3K9QRZ", "member", "2026-07-22T10:00:00Z")),
        )
    }
}

@Preview(name = "Invites — dark", showBackground = true)
@Composable
private fun InvitesScreenDarkPreview() {
    WaldoTheme(darkTheme = true) {
        InvitesScreen(state = InvitesUiState())
    }
}
