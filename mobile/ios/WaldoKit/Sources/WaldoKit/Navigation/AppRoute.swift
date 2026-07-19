/// specs/004-ios-client.md §1.2 — the I1 navigation scaffold. I2 adds routes for the feature
/// screens (map, history, geofences, locate, settings, invites); this foundation only needs enough
/// to demonstrate the seam between navigation and the design system.
public enum AppRoute: Equatable {
    case signIn
    case home
}
