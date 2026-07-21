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
}
