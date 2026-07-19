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
}
