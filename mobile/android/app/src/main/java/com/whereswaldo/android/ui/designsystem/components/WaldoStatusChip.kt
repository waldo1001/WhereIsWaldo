package com.whereswaldo.android.ui.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import com.whereswaldo.android.ui.designsystem.WaldoTheme

/** Semantic tone for a status chip — maps 1:1 onto a color token, never a raw color. */
enum class WaldoStatusTone { Success, Warning, Danger, Neutral }

/**
 * A small pill-shaped status indicator (device registered / paused / stale / error, …). Reads
 * only [WaldoTheme] tokens (specs/003-android-client.md §4.3).
 */
@Composable
fun WaldoStatusChip(
    label: String,
    tone: WaldoStatusTone,
    modifier: Modifier = Modifier,
) {
    val background: Color
    val onBackground: Color
    when (tone) {
        WaldoStatusTone.Success -> {
            background = WaldoTheme.colors.success
            onBackground = WaldoTheme.colors.onPrimary
        }
        WaldoStatusTone.Warning -> {
            background = WaldoTheme.colors.warning
            onBackground = WaldoTheme.colors.onSurface
        }
        WaldoStatusTone.Danger -> {
            background = WaldoTheme.colors.danger
            onBackground = WaldoTheme.colors.onDanger
        }
        WaldoStatusTone.Neutral -> {
            background = WaldoTheme.colors.surfaceVariant
            onBackground = WaldoTheme.colors.onSurface
        }
    }

    Text(
        text = label,
        color = onBackground,
        style = WaldoTheme.typography.labelSmall,
        modifier = modifier
            .clip(RoundedCornerShape(WaldoTheme.corner.pill))
            .background(background)
            .padding(horizontal = WaldoTheme.spacing.sm, vertical = WaldoTheme.spacing.xs),
    )
}
