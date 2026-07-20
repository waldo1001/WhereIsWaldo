package com.whereswaldo.android.ui.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.VisualTransformation
import com.whereswaldo.android.ui.designsystem.WaldoTheme

/**
 * A stateless, presentational single-line (by default) text input — added in A2 for the geofence
 * editor (name/lat/lon/radius), invite-code entry, and display-name fields; [visualTransformation]
 * added at H1 for the sign-in screen's password field (`PasswordVisualTransformation()`). Reads
 * only [WaldoTheme] tokens (specs/003-android-client.md §4.3); border width reuses
 * [WaldoTheme.elevation]'s `level1`, matching [WaldoMapMarkerBubble]'s existing convention for
 * hairline strokes so no raw `.dp` literal appears even inside this design-system file.
 */
@Composable
fun WaldoTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String? = null,
    isError: Boolean = false,
    supportingText: String? = null,
    singleLine: Boolean = true,
    enabled: Boolean = true,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        if (label != null) {
            Text(
                text = label,
                color = WaldoTheme.colors.outline,
                style = WaldoTheme.typography.labelSmall,
            )
        }

        val borderColor = if (isError) WaldoTheme.colors.danger else WaldoTheme.colors.outline

        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            singleLine = singleLine,
            keyboardOptions = keyboardOptions,
            visualTransformation = visualTransformation,
            textStyle = WaldoTheme.typography.bodyLarge.copy(color = WaldoTheme.colors.onSurface),
            cursorBrush = SolidColor(WaldoTheme.colors.primary),
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(WaldoTheme.corner.sm))
                .background(WaldoTheme.colors.surfaceVariant)
                .border(
                    width = WaldoTheme.elevation.level1,
                    color = borderColor,
                    shape = RoundedCornerShape(WaldoTheme.corner.sm),
                )
                .padding(horizontal = WaldoTheme.spacing.sm, vertical = WaldoTheme.spacing.sm),
            decorationBox = { innerTextField ->
                if (value.isEmpty() && placeholder != null) {
                    Text(
                        text = placeholder,
                        color = WaldoTheme.colors.outline,
                        style = WaldoTheme.typography.bodyLarge,
                    )
                }
                innerTextField()
            },
        )

        if (supportingText != null) {
            Text(
                text = supportingText,
                color = if (isError) WaldoTheme.colors.danger else WaldoTheme.colors.outline,
                style = WaldoTheme.typography.labelSmall,
            )
        }
    }
}
