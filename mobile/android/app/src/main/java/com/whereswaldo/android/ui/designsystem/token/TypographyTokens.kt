package com.whereswaldo.android.ui.designsystem.token

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** The six normative type roles (specs/003-android-client.md §4.1/§4.2). Same values in light
 * and dark — only [com.whereswaldo.android.ui.designsystem.token.WaldoColorTokens] varies by
 * theme. */
@Immutable
data class WaldoTypographyTokens(
    val displayLarge: TextStyle,
    val titleLarge: TextStyle,
    val titleMedium: TextStyle,
    val bodyLarge: TextStyle,
    val bodyMedium: TextStyle,
    val labelSmall: TextStyle,
)

// Waldo design system (design/waldo-design-system/) — platform system font (Roboto); sizes in sp.
val WaldoTypography = WaldoTypographyTokens(
    displayLarge = TextStyle(fontSize = 34.sp, lineHeight = 40.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.68).sp),
    titleLarge = TextStyle(fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.22).sp),
    titleMedium = TextStyle(fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 17.sp, lineHeight = 24.sp, fontWeight = FontWeight.Normal),
    bodyMedium = TextStyle(fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.Normal),
    labelSmall = TextStyle(fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.4.sp),
)

val LocalWaldoTypography = staticCompositionLocalOf { WaldoTypography }
