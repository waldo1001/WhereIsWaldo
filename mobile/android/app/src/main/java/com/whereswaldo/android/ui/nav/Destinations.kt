package com.whereswaldo.android.ui.nav

/**
 * Route string constants (specs/003-android-client.md §12). Only [Home] is implemented in A1;
 * the rest are reserved route names for A2 — deliberately just strings, no composables, so
 * nothing here can be mistaken for a half-built feature screen.
 */
sealed class Destinations(val route: String) {
    data object Home : Destinations("home")

    // Reserved for A2 — route names only, no screens yet.
    data object Map : Destinations("map")
    data object History : Destinations("history")
    data object Geofences : Destinations("geofences")
    data object Locate : Destinations("locate")
    data object Settings : Destinations("settings")
}
