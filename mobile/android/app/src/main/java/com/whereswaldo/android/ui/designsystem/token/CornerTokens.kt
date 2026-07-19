package com.whereswaldo.android.ui.designsystem.token

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Corner-radius scale (specs/003-android-client.md §4.1/§4.2). `pill` is large enough to always
 * round a component's shorter edge to a full stadium/circle regardless of its size. */
@Immutable
data class WaldoCornerTokens(
    val sm: Dp,
    val md: Dp,
    val lg: Dp,
    val pill: Dp,
)

val WaldoCorner = WaldoCornerTokens(
    sm = 4.dp,
    md = 8.dp,
    lg = 16.dp,
    pill = 999.dp,
)

val LocalWaldoCorner = staticCompositionLocalOf { WaldoCorner }
