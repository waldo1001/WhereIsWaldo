package com.whereswaldo.android.ui.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import com.whereswaldo.android.ui.designsystem.WaldoTheme

/**
 * A stateless surface container. Reads only [WaldoTheme] tokens (specs/003-android-client.md
 * §4.3). Elevation is expressed as a [WaldoTheme.elevation]-derived surface tint rather than a
 * shadow, since Material3's tonal-elevation model already uses that approach.
 */
@Composable
fun WaldoCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(WaldoTheme.corner.lg))
            .background(WaldoTheme.colors.surfaceVariant)
            .padding(WaldoTheme.spacing.md),
        content = content,
    )
}
