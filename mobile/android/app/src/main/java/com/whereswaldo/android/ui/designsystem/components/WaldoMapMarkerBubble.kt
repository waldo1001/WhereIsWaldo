package com.whereswaldo.android.ui.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import com.whereswaldo.android.ui.designsystem.WaldoTheme

/**
 * A map-marker label bubble (a family member's name pin on the live map, A2). Fresh (`isStale =
 * false`) uses the `primary` token; stale uses `outline`, so staleness reads identically across
 * both apps/themes without any per-screen color logic (001-api-contract.md §5.2's `isStale`
 * rule). Stateless — reads only [WaldoTheme] tokens (specs/003-android-client.md §4.3).
 */
@Composable
fun WaldoMapMarkerBubble(
    label: String,
    isStale: Boolean,
    modifier: Modifier = Modifier,
) {
    val tint = if (isStale) WaldoTheme.colors.outline else WaldoTheme.colors.primary

    Text(
        text = label,
        color = WaldoTheme.colors.surface,
        style = WaldoTheme.typography.labelSmall,
        modifier = modifier
            .clip(RoundedCornerShape(WaldoTheme.corner.pill))
            .background(tint)
            .border(width = WaldoTheme.elevation.level1, color = WaldoTheme.colors.surface, shape = RoundedCornerShape(WaldoTheme.corner.pill))
            .padding(horizontal = WaldoTheme.spacing.sm, vertical = WaldoTheme.spacing.xs),
    )
}
