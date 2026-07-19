package com.whereswaldo.android.ui.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.whereswaldo.android.ui.designsystem.WaldoTheme

/**
 * A stateless top app bar. Reads only [WaldoTheme] tokens (specs/003-android-client.md §4.3).
 */
@Composable
fun WaldoTopBar(
    title: String,
    modifier: Modifier = Modifier,
    navigationIcon: (@Composable () -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(WaldoTheme.colors.surface)
            .padding(horizontal = WaldoTheme.spacing.md, vertical = WaldoTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm),
    ) {
        navigationIcon?.invoke()

        Text(
            text = title,
            color = WaldoTheme.colors.onSurface,
            style = WaldoTheme.typography.titleLarge,
            modifier = Modifier.weight(1f),
        )

        actions()
    }
}
