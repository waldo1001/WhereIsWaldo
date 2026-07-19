package com.whereswaldo.android.ui.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.whereswaldo.android.ui.designsystem.WaldoTheme

/**
 * A loading placeholder. Stateless, reads only [WaldoTheme] tokens (specs/003-android-client.md
 * §4.3).
 */
@Composable
fun WaldoLoadingState(
    modifier: Modifier = Modifier,
    message: String? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(WaldoTheme.spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.sm),
    ) {
        CircularProgressIndicator(color = WaldoTheme.colors.primary)
        if (message != null) {
            Text(
                text = message,
                color = WaldoTheme.colors.outline,
                style = WaldoTheme.typography.bodyMedium,
            )
        }
    }
}
