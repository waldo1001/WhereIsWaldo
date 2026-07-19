import Foundation

/// specs/004-ios-client.md §4 — Firebase Auth abstraction. `StubAuthProvider` is the only
/// implementation shipped in I1; `FirebaseAuthProvider` is an H1 follow-up (adding it means one
/// new conforming type + a composition-root swap, zero change anywhere else).
public protocol AuthProviding: AnyObject {
    var currentUserId: String? { get }
    func currentIDToken() async throws -> String
    /// specs/001 §2.1 — clients MUST refresh via the auth SDK and retry once on
    /// `AUTH_TOKEN_EXPIRED` (see `URLSessionAPIClient`).
    func refreshIDToken() async throws -> String
    func signOut() throws
}

public enum AuthError: Error, Equatable {
    case notSignedIn
}
