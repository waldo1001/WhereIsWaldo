package com.whereswaldo.android.ui.history

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.rememberDatePickerState
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
import com.whereswaldo.android.ui.designsystem.components.WaldoEmptyState
import com.whereswaldo.android.ui.designsystem.components.WaldoErrorState
import com.whereswaldo.android.ui.designsystem.components.WaldoListRow
import com.whereswaldo.android.ui.designsystem.components.WaldoLoadingState
import com.whereswaldo.android.ui.designsystem.components.WaldoTextField
import com.whereswaldo.android.ui.designsystem.components.WaldoTopBar
import java.time.Instant
import java.time.ZoneOffset

/**
 * The A2 history screen (001-api-contract.md §5.3, specs/003-android-client.md §12's `History`
 * destination): a date-range picker + `userId`/optional-`deviceId` filter, a cursor-paginated
 * point list, driven by [HistoryViewModel]/[HistoryStateHolder]. The date pickers use Material3's
 * [DatePickerDialog] directly — one of the "un-migrated Material3 primitives" `WaldoTheme`
 * explicitly themes (specs/003 §4.3's `WaldoTheme` doc), not a design-system component, since
 * re-implementing a calendar widget is out of scope; its action buttons are still [WaldoButton]s.
 */
@Composable
fun HistoryRoute(
    viewModel: HistoryViewModel,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsState()
    HistoryScreen(
        state = state,
        onQuery = viewModel::load,
        onLoadMore = viewModel::loadMore,
        modifier = modifier,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(
    state: HistoryUiState,
    modifier: Modifier = Modifier,
    onQuery: (userId: String, from: String, to: String, deviceId: String?) -> Unit = { _, _, _, _ -> },
    onLoadMore: () -> Unit = {},
) {
    var userId by remember { mutableStateOf("") }
    var deviceId by remember { mutableStateOf("") }
    var fromDate by remember { mutableStateOf<String?>(null) }
    var toDate by remember { mutableStateOf<String?>(null) }
    var showFromPicker by remember { mutableStateOf(false) }
    var showToPicker by remember { mutableStateOf(false) }

    Column(modifier = modifier.fillMaxSize()) {
        WaldoTopBar(title = "History")

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(WaldoTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm),
        ) {
            WaldoTextField(value = userId, onValueChange = { userId = it }, label = "User ID")
            WaldoTextField(
                value = deviceId,
                onValueChange = { deviceId = it },
                label = "Device ID (optional — all devices when blank)",
            )

            Row(horizontalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm)) {
                WaldoButton(
                    text = fromDate?.let { "From: $it" } ?: "Pick from date",
                    onClick = { showFromPicker = true },
                    style = WaldoButtonStyle.Secondary,
                )
                WaldoButton(
                    text = toDate?.let { "To: $it" } ?: "Pick to date",
                    onClick = { showToPicker = true },
                    style = WaldoButtonStyle.Secondary,
                )
            }

            val from = fromDate
            val to = toDate
            WaldoButton(
                text = "Search",
                enabled = userId.isNotBlank() && from != null && to != null,
                onClick = {
                    if (from != null && to != null) {
                        onQuery(userId, from, to, deviceId.ifBlank { null })
                    }
                },
            )
        }

        when (state) {
            is HistoryUiState.Idle ->
                WaldoEmptyState(title = "No query yet", message = "Choose a user and date range, then search.")

            is HistoryUiState.Loading -> WaldoLoadingState(message = "Loading history…")

            is HistoryUiState.Error -> WaldoErrorState(title = "Couldn't load history", message = state.message)

            is HistoryUiState.Content -> {
                if (state.points.isEmpty()) {
                    WaldoEmptyState(title = "No history", message = "Nothing recorded in that range.")
                } else {
                    LazyColumn(
                        modifier = Modifier.padding(horizontal = WaldoTheme.spacing.md),
                        verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.xs),
                    ) {
                        items(state.points, key = { "${it.deviceId}-${it.recordedAt}" }) { point ->
                            WaldoListRow(
                                title = point.recordedAt,
                                subtitle = "${point.lat}, ${point.lon} · ${point.source} · ${point.batteryPct}%",
                            )
                        }
                        if (state.nextCursor != null) {
                            item(key = "load-more") {
                                WaldoButton(
                                    text = if (state.isLoadingMore) "Loading…" else "Load more",
                                    enabled = !state.isLoadingMore,
                                    onClick = onLoadMore,
                                    style = WaldoButtonStyle.Secondary,
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showFromPicker) {
        val pickerState = rememberDatePickerState()
        DatePickerDialog(
            onDismissRequest = { showFromPicker = false },
            confirmButton = {
                WaldoButton(
                    text = "OK",
                    onClick = {
                        pickerState.selectedDateMillis?.let { fromDate = it.toIsoDate() }
                        showFromPicker = false
                    },
                )
            },
            dismissButton = { WaldoButton(text = "Cancel", onClick = { showFromPicker = false }, style = WaldoButtonStyle.Secondary) },
        ) { DatePicker(state = pickerState) }
    }

    if (showToPicker) {
        val pickerState = rememberDatePickerState()
        DatePickerDialog(
            onDismissRequest = { showToPicker = false },
            confirmButton = {
                WaldoButton(
                    text = "OK",
                    onClick = {
                        pickerState.selectedDateMillis?.let { toDate = it.toIsoDate() }
                        showToPicker = false
                    },
                )
            },
            dismissButton = { WaldoButton(text = "Cancel", onClick = { showToPicker = false }, style = WaldoButtonStyle.Secondary) },
        ) { DatePicker(state = pickerState) }
    }
}

/** Epoch millis (UTC, as `DatePickerState` always reports) to a §5.3 `YYYY-MM-DD` device-agnostic
 * UTC date string. */
private fun Long.toIsoDate(): String = Instant.ofEpochMilli(this).atZone(ZoneOffset.UTC).toLocalDate().toString()

@Preview(name = "History — light", showBackground = true)
@Composable
private fun HistoryScreenLightPreview() {
    WaldoTheme(darkTheme = false) {
        HistoryScreen(
            state = HistoryUiState.Content(
                points = listOf(
                    HistoryPointUi("d1", "2026-07-19T09:05:12Z", 51.05, 3.71, 12.5, 78, "periodic"),
                ),
                nextCursor = null,
            ),
        )
    }
}

@Preview(name = "History — dark", showBackground = true)
@Composable
private fun HistoryScreenDarkPreview() {
    WaldoTheme(darkTheme = true) {
        HistoryScreen(state = HistoryUiState.Idle)
    }
}
