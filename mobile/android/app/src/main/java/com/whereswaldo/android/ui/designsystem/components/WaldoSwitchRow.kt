package com.whereswaldo.android.ui.designsystem.components

import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.whereswaldo.android.ui.designsystem.WaldoTheme

/**
 * A [WaldoListRow] with a trailing toggle — added in A2 for device settings (pause/
 * `trackingEnabled`) and geofence notify-on-enter/exit flags. Composes only the existing
 * [WaldoListRow] plus a [Switch] explicitly recolored from [WaldoTheme] tokens (never a raw
 * `Color(...)` literal), so a device-settings/geofence screen never needs to reach for a bare
 * Material3 primitive with default (un-themed) colors (specs/003-android-client.md §4.3).
 */
@Composable
fun WaldoSwitchRow(
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    enabled: Boolean = true,
) {
    WaldoListRow(
        title = title,
        subtitle = subtitle,
        modifier = modifier,
        trailing = {
            Switch(
                checked = checked,
                onCheckedChange = onCheckedChange,
                enabled = enabled,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = WaldoTheme.colors.onPrimary,
                    checkedTrackColor = WaldoTheme.colors.primary,
                    uncheckedThumbColor = WaldoTheme.colors.onSurface,
                    uncheckedTrackColor = WaldoTheme.colors.surfaceVariant,
                ),
            )
        },
    )
}
