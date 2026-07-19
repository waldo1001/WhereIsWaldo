package com.whereswaldo.android.ui.designsystem.token

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * The color half of the design-token contract (specs/003-android-client.md §4.1/§4.2).
 * These are the ONLY color values allowed to exist anywhere in the app outside this file —
 * every component reads [com.whereswaldo.android.ui.designsystem.WaldoTheme.colors] instead of
 * constructing a [Color] literal.
 */
@Immutable
data class WaldoColorTokens(
    val primary: Color,
    val onPrimary: Color,
    val secondary: Color,
    val surface: Color,
    val onSurface: Color,
    val surfaceVariant: Color,
    val danger: Color,
    val onDanger: Color,
    val success: Color,
    val warning: Color,
    val outline: Color,
)

/** Placeholder design (specs/003 §4.2) — fully swappable, this is the point of the seam. */
val LightWaldoColors = WaldoColorTokens(
    primary = Color(0xFF2962FF),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF00897B),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1A1C1E),
    surfaceVariant = Color(0xFFE7E9EC),
    danger = Color(0xFFD32F2F),
    onDanger = Color(0xFFFFFFFF),
    success = Color(0xFF2E7D32),
    warning = Color(0xFFF9A825),
    outline = Color(0xFF79747E),
)

val DarkWaldoColors = WaldoColorTokens(
    primary = Color(0xFF82B1FF),
    onPrimary = Color(0xFF00296B),
    secondary = Color(0xFF4DB6AC),
    surface = Color(0xFF121316),
    onSurface = Color(0xFFE3E2E6),
    surfaceVariant = Color(0xFF44474A),
    danger = Color(0xFFEF5350),
    onDanger = Color(0xFF601410),
    success = Color(0xFF66BB6A),
    warning = Color(0xFFFFD54F),
    outline = Color(0xFF8E9099),
)

val LocalWaldoColors = staticCompositionLocalOf { LightWaldoColors }
