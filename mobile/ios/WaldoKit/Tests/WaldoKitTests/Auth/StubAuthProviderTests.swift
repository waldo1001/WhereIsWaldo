import Testing
@testable import WaldoKit

/// specs/004-ios-client.md §4 — the dev/test AuthProviding implementation.
struct StubAuthProviderTests {

    @Test func currentIDToken_returnsATokenWhenSignedIn() async throws {
        let provider = StubAuthProvider(currentUserId: "u1")
        let token = try await provider.currentIDToken()
        #expect(!token.isEmpty)
        #expect(provider.currentUserId == "u1")
    }

    @Test func currentIDToken_throwsWhenNotSignedIn() async throws {
        let provider = StubAuthProvider(currentUserId: nil)
        do {
            _ = try await provider.currentIDToken()
            Issue.record("expected AuthError.notSignedIn")
        } catch let error as AuthError {
            #expect(error == .notSignedIn)
        }
    }

    @Test func signOut_clearsCurrentUserId() async throws {
        let provider = StubAuthProvider(currentUserId: "u1")
        try provider.signOut()
        #expect(provider.currentUserId == nil)
        do {
            _ = try await provider.currentIDToken()
            Issue.record("expected AuthError.notSignedIn")
        } catch let error as AuthError {
            #expect(error == .notSignedIn)
        }
    }

    @Test func refreshIDToken_yieldsADifferentTokenThanBefore() async throws {
        let provider = StubAuthProvider(currentUserId: "u1")
        let first = try await provider.currentIDToken()
        let refreshed = try await provider.refreshIDToken()
        #expect(first != refreshed)
        // Subsequent reads reflect the refreshed token until refreshed again.
        let again = try await provider.currentIDToken()
        #expect(again == refreshed)
    }
}
