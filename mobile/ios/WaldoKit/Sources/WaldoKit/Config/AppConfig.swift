import Foundation

/// specs/004-ios-client.md §8 — the one place H1-dependent values are injected. No secrets, no
/// real third-party host: the default `baseURL` uses the `.invalid` TLD (RFC 2606), which never
/// resolves, so nothing here can be mistaken for (or accidentally hit) a real backend.
public struct AppConfig: Equatable {
    public var baseURL: URL
    public var authMode: AuthMode
    /// specs/006-phone-auth.md §5 — feeds `StubAuthProvider`'s fake `iss`/`aud` claims in dev mode
    /// (`iss = "https://securetoken.google.com/<firebaseProjectId>"`, `aud = firebaseProjectId`).
    /// A dev default is fine here: H1 supplies the real Firebase project id via the app target's
    /// build configuration, never by editing this default.
    public var firebaseProjectId: String

    public init(
        baseURL: URL = AppConfig.placeholderBaseURL,
        authMode: AuthMode = .stubLocal,
        firebaseProjectId: String = "wheres-waldo-dev"
    ) {
        self.baseURL = baseURL
        self.authMode = authMode
        self.firebaseProjectId = firebaseProjectId
    }

    /// Obviously non-resolving placeholder — H1 supplies the real Azure Functions base URL via
    /// the app target's build configuration, never by editing this default.
    public static let placeholderBaseURL = URL(string: "https://api.wheres-waldo.invalid/api/v1")!
}

public enum AuthMode: Equatable {
    /// `StubAuthProvider` — matches the backend's `AUTH_MODE=insecure-local` (specs/001 §2.3).
    case stubLocal
    /// `FirebaseAuthProvider` — H1 follow-up, not implemented in I1 (no Firebase SDK dependency,
    /// no `GoogleService-Info.plist`).
    case firebase
}
