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

    // MARK: - I5 groups routes (specs/004 §3.4)

    public func showGroupsList() {
        route = .groupsList
    }

    public func showCreateGroup() {
        route = .createGroup
    }

    public func showGroupDetail(groupId: String) {
        route = .groupDetail(groupId: groupId)
    }

    public func showGroupJoin(prefillCode: String = "") {
        route = .groupJoin(prefillCode: prefillCode)
    }

    public func showGroupMap(groupId: String) {
        route = .groupMap(groupId: groupId)
    }

    /// The app target's `onOpenURL` forwards here (specs/004 §3.4) — `GroupCodeParsing` (pure,
    /// WaldoKit) validates/normalizes the incoming `waldo://group-join?code=…` link BEFORE any
    /// route change; an unrecognized URL is silently ignored (no route change, no crash) rather
    /// than surfacing a raw error for what may be an unrelated/malformed external URL.
    public func handleDeepLink(_ url: URL) {
        guard let code = GroupCodeParsing.normalize(url.absoluteString) else { return }
        route = .groupJoin(prefillCode: code)
    }
}
