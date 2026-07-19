package com.whereswaldo.android.ui.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.whereswaldo.android.ui.designsystem.WaldoTheme

/**
 * Every design-system component rendered together — a visual regression aid so a future design
 * swap (docs/design-prompt.md, per docs/implementation-handoff.md's Mobile H1-waiver note) can
 * be checked at a glance in both themes. Not a screen; not wired into navigation.
 */
@Composable
private fun ComponentGallery(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(WaldoTheme.colors.surface)
            .padding(WaldoTheme.spacing.md),
        verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.md),
    ) {
        WaldoTopBar(title = "Where's waldo")

        WaldoButton(text = "Primary action", onClick = {})
        WaldoButton(text = "Secondary action", onClick = {}, style = WaldoButtonStyle.Secondary)
        WaldoButton(text = "Disabled", onClick = {}, enabled = false)

        WaldoCard {
            Text(
                text = "Card content",
                color = WaldoTheme.colors.onSurface,
                style = WaldoTheme.typography.bodyLarge,
            )
        }

        WaldoListRow(title = "Noor", subtitle = "Last seen 2 min ago")

        Column(verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.xs)) {
            WaldoStatusChip(label = "Registered", tone = WaldoStatusTone.Success)
            WaldoStatusChip(label = "Stale", tone = WaldoStatusTone.Warning)
            WaldoStatusChip(label = "Error", tone = WaldoStatusTone.Danger)
            WaldoStatusChip(label = "Paused", tone = WaldoStatusTone.Neutral)
        }

        WaldoMapMarkerBubble(label = "Eric", isStale = false)
        WaldoMapMarkerBubble(label = "Noor", isStale = true)

        WaldoTextField(
            value = "Home",
            onValueChange = {},
            label = "Name",
            placeholder = "e.g. Home",
        )
        WaldoTextField(
            value = "",
            onValueChange = {},
            label = "Radius (m)",
            isError = true,
            supportingText = "Must be between 100 and 5000",
        )

        WaldoSwitchRow(title = "Tracking enabled", checked = true, onCheckedChange = {})
        WaldoSwitchRow(title = "Notify on enter", checked = false, onCheckedChange = {}, subtitle = "Geofence: Home")

        WaldoEmptyState(title = "No devices yet", message = "Register a device to see it here.")
        WaldoLoadingState(message = "Loading…")
        WaldoErrorState(title = "Something went wrong", message = "Couldn't reach the server.", onRetry = {})
    }
}

@Preview(name = "Component gallery — light", showBackground = true)
@Composable
private fun ComponentGalleryLightPreview() {
    WaldoTheme(darkTheme = false) {
        ComponentGallery()
    }
}

@Preview(name = "Component gallery — dark", showBackground = true)
@Composable
private fun ComponentGalleryDarkPreview() {
    WaldoTheme(darkTheme = true) {
        ComponentGallery()
    }
}
