import Foundation

/// A dev/test-only `AuthProviding`. Produces an **unsigned** token shaped like a JWT
/// (`header.payload.signature`) matching the backend's `AUTH_MODE=insecure-local` (specs/001
/// §2.3) — the backend trusts the payload's `sub` as-is in that mode. This type is never valid
/// against a real Firebase-verifying backend and MUST NOT be used once `FirebaseAuthProvider`
/// (H1) exists.
public final class StubAuthProvider: AuthProviding {
    public private(set) var currentUserId: String?
    private var tokenVersion = 0

    public init(currentUserId: String? = "stub-user-1") {
        self.currentUserId = currentUserId
    }

    public func currentIDToken() async throws -> String {
        guard let uid = currentUserId else { throw AuthError.notSignedIn }
        return Self.unsignedToken(uid: uid, version: tokenVersion)
    }

    public func refreshIDToken() async throws -> String {
        tokenVersion += 1
        return try await currentIDToken()
    }

    public func signOut() throws {
        currentUserId = nil
    }

    private static func unsignedToken(uid: String, version: Int) -> String {
        "stub-header.\(uid)-v\(version).stub-signature"
    }
}
