package com.whereswaldo.android.ui.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import com.whereswaldo.android.ui.designsystem.WaldoTheme

/**
 * "Nothing here yet" placeholder (e.g. no devices registered, no history in range). Stateless,
 * reads only [WaldoTheme] tokens (specs/003-android-client.md §4.3).
 */
@Composable
fun WaldoEmptyState(
    title: String,
    message: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(WaldoTheme.spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm),
    ) {
        Text(
            text = title,
            color = WaldoTheme.colors.onSurface,
            style = WaldoTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
        )
        Text(
            text = message,
            color = WaldoTheme.colors.outline,
            style = WaldoTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )
    }
}
