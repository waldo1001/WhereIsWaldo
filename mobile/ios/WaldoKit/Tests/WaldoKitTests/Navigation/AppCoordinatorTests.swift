import Foundation
import Testing
@testable import WaldoKit

/// specs/004-ios-client.md §3.4 — `AppCoordinator.handleDeepLink(_:)` is the app target's
/// `onOpenURL` forwarding target for the `waldo://group-join?code=…` deep link (parsed in
/// WaldoKit, per §3.4). Every other `AppCoordinator` method is a trivial one-line route
/// assignment (untested elsewhere in this codebase, same as I1/I2's convention of not testing
/// pure plumbing) — `handleDeepLink` is the one case with actual conditional logic worth covering.
@MainActor
struct AppCoordinatorTests {

    @Test func handleDeepLink_validGroupJoinLink_routesToGroupJoinWithNormalizedCode() {
        let coordinator = AppCoordinator(route: .home)

        coordinator.handleDeepLink(URL(string: "waldo://group-join?code=7f3k-9qrz")!)

        #expect(coordinator.route == .groupJoin(prefillCode: "7F3K9QRZ"))
    }

    @Test func handleDeepLink_invalidLink_leavesRouteUnchanged() {
        let coordinator = AppCoordinator(route: .home)

        coordinator.handleDeepLink(URL(string: "https://evil.example/not-a-group")!)

        #expect(coordinator.route == .home)
    }

    @Test func handleDeepLink_inviteDeepLink_isIgnoredNotMisroutedToGroupJoin() {
        let coordinator = AppCoordinator(route: .home)

        coordinator.handleDeepLink(URL(string: "waldo://invite/7F3K9QRZ")!)

        #expect(coordinator.route == .home)
    }
}
