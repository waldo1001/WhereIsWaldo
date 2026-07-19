/// specs/004-ios-client.md §1.2 — the navigation scaffold. I2 adds the feature-screen routes below
/// (map, history, geofences, locate, settings, invites) on top of I1's `signIn`/`home` seam.
public enum AppRoute: Equatable {
    case signIn
    case home
    case liveMap
    case history(userId: String, deviceId: String?)
    case geofences
    case locate(target: LocateTarget, targetDisplayName: String)
    case deviceSettings(isParent: Bool)
    case familyMembers
    case createInvite
    case acceptInvite(prefillCode: String)
}
