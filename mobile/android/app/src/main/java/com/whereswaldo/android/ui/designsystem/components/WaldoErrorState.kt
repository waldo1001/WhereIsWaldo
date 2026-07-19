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
 * An error placeholder with an optional retry action. Stateless, reads only [WaldoTheme] tokens
 * (specs/003-android-client.md §4.3). `message` is expected to already be a localized/UX string
 * — [com.whereswaldo.android.network.ApiError] mapping to user-facing text is a ViewModel/screen
 * concern (A2), not this component's.
 */
@Composable
fun WaldoErrorState(
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    onRetry: (() -> Unit)? = null,
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
            color = WaldoTheme.colors.danger,
            style = WaldoTheme.typography.titleMedium,
            textAlign = TextAlign.Center,
        )
        Text(
            text = message,
            color = WaldoTheme.colors.onSurface,
            style = WaldoTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )
        if (onRetry != null) {
            WaldoButton(
                text = "Retry",
                onClick = onRetry,
                style = WaldoButtonStyle.Secondary,
            )
        }
    }
}
