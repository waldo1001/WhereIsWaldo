package com.whereswaldo.android.ui.geofences

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.whereswaldo.android.ui.designsystem.components.WaldoCard
import com.whereswaldo.android.ui.designsystem.components.WaldoEmptyState
import com.whereswaldo.android.ui.designsystem.components.WaldoErrorState
import com.whereswaldo.android.ui.designsystem.components.WaldoListRow
import com.whereswaldo.android.ui.designsystem.components.WaldoLoadingState
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusChip
import com.whereswaldo.android.ui.designsystem.components.WaldoStatusTone
import com.whereswaldo.android.ui.designsystem.components.WaldoSwitchRow
import com.whereswaldo.android.ui.designsystem.components.WaldoTextField
import com.whereswaldo.android.ui.designsystem.components.WaldoTopBar

/**
 * The A2 geofence editor (001-api-contract.md §7.1/§7.2, specs/003-android-client.md §12's
 * `Geofences` destination): list + add/edit/delete form, driven by
 * [GeofencesViewModel]/[GeofencesStateHolder]. Rendered entirely through `ui/designsystem`
 * components.
 */
@Composable
fun GeofencesRoute(viewModel: GeofencesViewModel, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsState()
    GeofencesScreen(
        state = state,
        onValidate = viewModel::validate,
        onUpsert = viewModel::upsertGeofence,
        onRemove = viewModel::removeGeofence,
        onSave = viewModel::save,
        onRetry = viewModel::reload,
        modifier = modifier,
    )
}

@Composable
fun GeofencesScreen(
    state: GeofencesUiState,
    modifier: Modifier = Modifier,
    onValidate: (GeofenceUi) -> String? = { null },
    onUpsert: (GeofenceUi) -> Unit = {},
    onRemove: (String) -> Unit = {},
    onSave: () -> Unit = {},
    onRetry: () -> Unit = {},
) {
    var editingDraft by remember { mutableStateOf<GeofenceUi?>(null) }
    var validationError by remember { mutableStateOf<String?>(null) }

    Column(modifier = modifier.fillMaxSize()) {
        WaldoTopBar(
            title = "Geofences",
            actions = {
                WaldoButton(
                    text = "Add",
                    onClick = {
                        editingDraft = GeofenceUi(
                            geofenceId = "gf_${System.currentTimeMillis()}",
                            name = "",
                            lat = 0.0,
                            lon = 0.0,
                            radiusM = 150.0,
                            icon = "pin",
                            notifyOnEnter = true,
                            notifyOnExit = true,
                        )
                    },
                    style = WaldoButtonStyle.Secondary,
                )
            },
        )

        when (state) {
            is GeofencesUiState.Loading -> WaldoLoadingState(message = "Loading geofences…")

            is GeofencesUiState.Error -> WaldoErrorState(
                title = "Couldn't load geofences",
                message = state.message,
                onRetry = onRetry,
            )

            is GeofencesUiState.Content -> {
                val draft = editingDraft
                if (draft != null) {
                    GeofenceEditor(
                        draft = draft,
                        error = validationError,
                        onChange = { editingDraft = it },
                        onCancel = { editingDraft = null; validationError = null },
                        onSave = {
                            val problem = onValidate(draft)
                            if (problem != null) {
                                validationError = problem
                            } else {
                                onUpsert(draft)
                                editingDraft = null
                                validationError = null
                            }
                        },
                    )
                } else {
                    Column(modifier = Modifier.padding(WaldoTheme.spacing.md)) {
                        if (state.conflict) {
                            WaldoStatusChip(
                                label = "Someone else changed this — review, then save again",
                                tone = WaldoStatusTone.Warning,
                            )
                        }
                        if (state.saveError != null) {
                            WaldoStatusChip(label = state.saveError, tone = WaldoStatusTone.Danger)
                        }
                    }

                    if (state.geofences.isEmpty()) {
                        WaldoEmptyState(title = "No geofences yet", message = "Tap Add to create one.")
                    } else {
                        LazyColumn(
                            modifier = Modifier.padding(horizontal = WaldoTheme.spacing.md),
                            verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.xs),
                        ) {
                            items(state.geofences, key = { it.geofenceId }) { geofence ->
                                WaldoListRow(
                                    title = geofence.name,
                                    subtitle = "${geofence.radiusM.toInt()} m radius",
                                    trailing = {
                                        Row(horizontalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.xs)) {
                                            WaldoButton(
                                                text = "Edit",
                                                onClick = { editingDraft = geofence },
                                                style = WaldoButtonStyle.Secondary,
                                            )
                                            WaldoButton(
                                                text = "Delete",
                                                onClick = { onRemove(geofence.geofenceId) },
                                                style = WaldoButtonStyle.Secondary,
                                            )
                                        }
                                    },
                                )
                            }
                        }
                    }

                    WaldoButton(
                        text = if (state.isSaving) "Saving…" else "Save changes",
                        enabled = !state.isSaving,
                        onClick = onSave,
                        modifier = Modifier.padding(WaldoTheme.spacing.md),
                    )
                }
            }
        }
    }
}

@Composable
private fun GeofenceEditor(
    draft: GeofenceUi,
    error: String?,
    onChange: (GeofenceUi) -> Unit,
    onCancel: () -> Unit,
    onSave: () -> Unit,
) {
    WaldoCard(modifier = Modifier.padding(WaldoTheme.spacing.md).fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm)) {
            WaldoTextField(value = draft.name, onValueChange = { onChange(draft.copy(name = it)) }, label = "Name")
            WaldoTextField(
                value = draft.lat.toString(),
                onValueChange = { it.toDoubleOrNull()?.let { lat -> onChange(draft.copy(lat = lat)) } },
                label = "Latitude",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            )
            WaldoTextField(
                value = draft.lon.toString(),
                onValueChange = { it.toDoubleOrNull()?.let { lon -> onChange(draft.copy(lon = lon)) } },
                label = "Longitude",
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            )
            WaldoTextField(
                value = draft.radiusM.toString(),
                onValueChange = { it.toDoubleOrNull()?.let { radius -> onChange(draft.copy(radiusM = radius)) } },
                label = "Radius (m) — 100 to 5000",
                isError = error != null,
                supportingText = error,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            )
            WaldoSwitchRow(
                title = "Notify on enter",
                checked = draft.notifyOnEnter,
                onCheckedChange = { onChange(draft.copy(notifyOnEnter = it)) },
            )
            WaldoSwitchRow(
                title = "Notify on exit",
                checked = draft.notifyOnExit,
                onCheckedChange = { onChange(draft.copy(notifyOnExit = it)) },
            )
            Row(horizontalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm)) {
                WaldoButton(text = "Save", onClick = onSave)
                WaldoButton(text = "Cancel", onClick = onCancel, style = WaldoButtonStyle.Secondary)
            }
        }
    }
}

@Preview(name = "Geofences — light", showBackground = true)
@Composable
private fun GeofencesScreenLightPreview() {
    WaldoTheme(darkTheme = false) {
        GeofencesScreen(
            state = GeofencesUiState.Content(
                geofences = listOf(
                    GeofenceUi("gf_home", "Home", 51.0543, 3.7174, 150.0, "home", true, true),
                ),
                etag = "\"4\"",
            ),
        )
    }
}

@Preview(name = "Geofences — dark", showBackground = true)
@Composable
private fun GeofencesScreenDarkPreview() {
    WaldoTheme(darkTheme = true) {
        GeofencesScreen(state = GeofencesUiState.Loading)
    }
}
