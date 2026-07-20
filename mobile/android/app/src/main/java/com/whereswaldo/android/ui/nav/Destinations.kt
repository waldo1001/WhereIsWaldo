package com.whereswaldo.android.ui.nav

/**
 * Route string constants (specs/003-android-client.md §12). [Home]/[Map]/[History]/[Geofences]/
 * [Locate]/[Settings] were reserved in A1 and are wired to real screens in A2; [Invites] is a new
 * A2 addition (§3.3/§3.4) — additive, same convention as the rest.
 *
 * [Locate] carries no path argument: the target member is passed via [WaldoNavHost]'s own
 * `remember`-held selection state (set by [com.whereswaldo.android.ui.map.MapScreen]'s
 * `onSelectMember`) rather than a nav-graph path segment, deliberately — this app has no external
 * deep-link entry points, so there is nothing to gain from a `{userId}` path template (and
 * everything to lose from hand-rolling percent-encoding for a `displayName` that may contain
 * spaces, without a toolchain here to compile-verify it).
 */
sealed class Destinations(val route: String) {
    data object Home : Destinations("home")
    data object Map : Destinations("map")
    data object History : Destinations("history")
    data object Geofences : Destinations("geofences")
    data object Locate : Destinations("locate")
    data object Settings : Destinations("settings")
    data object Invites : Destinations("invites")
    data object SignIn : Destinations("sign-in")
}
