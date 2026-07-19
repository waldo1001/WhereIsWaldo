package com.whereswaldo.android.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import com.whereswaldo.android.ui.designsystem.WaldoTheme
import com.whereswaldo.android.ui.designsystem.components.WaldoEmptyState
import com.whereswaldo.android.ui.designsystem.components.WaldoMapMarkerBubble

/**
 * The A2 stub [MapRenderer] (no Google Maps SDK/API key exists yet — H1-gated, see [MapRenderer]'s
 * doc). Renders a placeholder surface plus every device with a known location as a
 * [WaldoMapMarkerBubble] — no real geographic projection, but the roster's marker set is visible
 * end-to-end so the screen composes correctly today and only the tile layer needs replacing
 * later. Stateless; composes only `ui/designsystem` components and reads only [WaldoTheme] tokens
 * (specs/003-android-client.md §4.3) — no raw Material3 primitive appears in this file.
 */
class PlaceholderMapRenderer : MapRenderer {
    @Composable
    override fun Render(members: List<RosterMemberUi>, modifier: Modifier) {
        val markers = members.flatMap { member ->
            member.devices.filter { it.hasLocation }.map { device -> member.displayName to device }
        }

        Column(
            modifier = modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(WaldoTheme.corner.lg))
                .background(WaldoTheme.colors.surfaceVariant)
                .padding(WaldoTheme.spacing.md),
            verticalArrangement = Arrangement.spacedBy(WaldoTheme.spacing.xs),
        ) {
            if (markers.isEmpty()) {
                WaldoEmptyState(
                    title = "Map preview",
                    message = "Real tiles land with H1 (docs/azure-setup.md).",
                )
            } else {
                markers.forEach { (displayName, device) ->
                    WaldoMapMarkerBubble(
                        label = "$displayName · ${device.deviceName}",
                        isStale = device.isStale ?: false,
                    )
                }
            }
        }
    }
}
