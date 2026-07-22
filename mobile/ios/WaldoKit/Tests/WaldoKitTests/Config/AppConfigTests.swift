import Testing
@testable import WaldoKit

/// specs/004-ios-client.md §8, specs/006-phone-auth.md §5 — `firebaseProjectId` feeds
/// `StubAuthProvider`'s fake `iss`/`aud` in dev mode; H1 supplies the real Firebase project id via
/// the app target's build configuration, never by editing this default.
struct AppConfigTests {

    @Test func defaultAuthModeIsStubLocal() {
        #expect(AppConfig().authMode == .stubLocal)
    }

    @Test func firebaseProjectIdHasANonEmptyDevDefault() {
        #expect(!AppConfig().firebaseProjectId.isEmpty)
    }

    @Test func firebaseProjectIdIsConfigurable() {
        let config = AppConfig(firebaseProjectId: "some-other-project")
        #expect(config.firebaseProjectId == "some-other-project")
    }

    // specs/004-ios-client.md §3.5/§8, specs/007-public-join-links.md §1 — `joinLinkHost` is the
    // 007 deployment constant (recorded at H4). Like `baseURL`'s `.invalid`-TLD placeholder, the
    // default here is obviously a placeholder (never a real, resolvable host) so H1/H4 provisioning
    // is a config change, never an edit to this default.
    @Test func joinLinkHostHasAnObviouslyPlaceholderDefault() {
        #expect(AppConfig().joinLinkHost == AppConfig.placeholderJoinLinkHost)
        #expect(AppConfig.placeholderJoinLinkHost.contains("CHANGE-ME"))
    }

    @Test func joinLinkHostIsConfigurable() {
        let config = AppConfig(joinLinkHost: "swa-whereiswaldo.azurestaticapps.net")
        #expect(config.joinLinkHost == "swa-whereiswaldo.azurestaticapps.net")
    }
}
