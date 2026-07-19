package com.whereswaldo.android.ui.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import com.whereswaldo.android.ui.designsystem.token.DarkWaldoColors
import com.whereswaldo.android.ui.designsystem.token.LightWaldoColors
import com.whereswaldo.android.ui.designsystem.token.LocalWaldoColors
import com.whereswaldo.android.ui.designsystem.token.LocalWaldoCorner
import com.whereswaldo.android.ui.designsystem.token.LocalWaldoElevation
import com.whereswaldo.android.ui.designsystem.token.LocalWaldoSpacing
import com.whereswaldo.android.ui.designsystem.token.LocalWaldoTypography
import com.whereswaldo.android.ui.designsystem.token.WaldoColorTokens
import com.whereswaldo.android.ui.designsystem.token.WaldoCorner
import com.whereswaldo.android.ui.designsystem.token.WaldoElevation
import com.whereswaldo.android.ui.designsystem.token.WaldoSpacing
import com.whereswaldo.android.ui.designsystem.token.WaldoTypography

/**
 * The only sanctioned way any composable in this app reads style. Screens/components call
 * `WaldoTheme.colors.primary`, `WaldoTheme.spacing.md`, etc. — never a hardcoded `Color(...)`,
 * `.dp`, or `.sp` (specs/003-android-client.md §4.3).
 */
object WaldoTheme {
    val colors: WaldoColorTokens
        @Composable get() = LocalWaldoColors.current

    val typography
        @Composable get() = LocalWaldoTypography.current

    val spacing
        @Composable get() = LocalWaldoSpacing.current

    val corner
        @Composable get() = LocalWaldoCorner.current

    val elevation
        @Composable get() = LocalWaldoElevation.current
}

/**
 * Provides the full design-token contract and additionally maps it onto a real Material3
 * [MaterialTheme] ([androidx.compose.material3.ColorScheme]/[Typography]/[Shapes]) so any
 * un-migrated Material3 primitive still themes correctly. Ships both light and dark token sets
 * from day one (specs/003 §4) — swapping either is a one-file change to
 * `ui/designsystem/token/ColorTokens.kt`, nothing else.
 */
@Composable
fun WaldoTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val tokens = if (darkTheme) DarkWaldoColors else LightWaldoColors

    val colorScheme = if (darkTheme) {
        darkColorScheme(
            primary = tokens.primary,
            onPrimary = tokens.onPrimary,
            secondary = tokens.secondary,
            surface = tokens.surface,
            onSurface = tokens.onSurface,
            surfaceVariant = tokens.surfaceVariant,
            error = tokens.danger,
            onError = tokens.onDanger,
            outline = tokens.outline,
        )
    } else {
        lightColorScheme(
            primary = tokens.primary,
            onPrimary = tokens.onPrimary,
            secondary = tokens.secondary,
            surface = tokens.surface,
            onSurface = tokens.onSurface,
            surfaceVariant = tokens.surfaceVariant,
            error = tokens.danger,
            onError = tokens.onDanger,
            outline = tokens.outline,
        )
    }

    val materialTypography = Typography(
        displayLarge = WaldoTypography.displayLarge,
        titleLarge = WaldoTypography.titleLarge,
        titleMedium = WaldoTypography.titleMedium,
        bodyLarge = WaldoTypography.bodyLarge,
        bodyMedium = WaldoTypography.bodyMedium,
        labelSmall = WaldoTypography.labelSmall,
    )

    val shapes = Shapes(
        small = RoundedCornerShape(WaldoCorner.sm),
        medium = RoundedCornerShape(WaldoCorner.md),
        large = RoundedCornerShape(WaldoCorner.lg),
    )

    CompositionLocalProvider(
        LocalWaldoColors provides tokens,
        LocalWaldoTypography provides WaldoTypography,
        LocalWaldoSpacing provides WaldoSpacing,
        LocalWaldoCorner provides WaldoCorner,
        LocalWaldoElevation provides WaldoElevation,
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = materialTypography,
            shapes = shapes,
            content = content,
        )
    }
}
