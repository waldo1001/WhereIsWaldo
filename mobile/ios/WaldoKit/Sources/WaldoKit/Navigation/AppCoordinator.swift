import Foundation

/// specs/004-ios-client.md §1.2, §2.4 — owns the current route. Contains zero styling; the app
/// target's root view switches on `route` to pick which screen (composed from design-system
/// components) to show.
@MainActor
public final class AppCoordinator: ObservableObject {
    @Published public private(set) var route: AppRoute

    public init(route: AppRoute = .signIn) {
        self.route = route
    }

    public func showSignIn() {
        route = .signIn
    }

    public func showHome() {
        route = .home
    }

    // MARK: - I2 feature-screen routes

    public func showLiveMap() {
        route = .liveMap
    }

    public func showHistory(userId: String, deviceId: String? = nil) {
        route = .history(userId: userId, deviceId: deviceId)
    }

    public func showGeofences() {
        route = .geofences
    }

    public func showLocate(target: LocateTarget, targetDisplayName: String) {
        route = .locate(target: target, targetDisplayName: targetDisplayName)
    }

    public func showDeviceSettings(isParent: Bool) {
        route = .deviceSettings(isParent: isParent)
    }

    public func showFamilyMembers() {
        route = .familyMembers
    }

    public func showCreateInvite() {
        route = .createInvite
    }

    public func showAcceptInvite(prefillCode: String = "") {
        route = .acceptInvite(prefillCode: prefillCode)
    }
}
