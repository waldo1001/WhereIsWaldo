package com.whereswaldo.android.ui.designsystem.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.whereswaldo.android.ui.designsystem.WaldoTheme

/**
 * A stateless section-title label (grouping a list — e.g. "Devices"/"Members" on the A2 settings
 * screen). Added in A2 so a screen never needs to reach for a bare Material3 `Text` composable
 * directly (specs/003-android-client.md §4.3: screens compose only `ui/designsystem` components).
 * Reads only [WaldoTheme] tokens.
 */
@Composable
fun WaldoSectionHeader(
    title: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = title,
        color = WaldoTheme.colors.onSurface,
        style = WaldoTheme.typography.titleMedium,
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = WaldoTheme.spacing.xs),
    )
}
