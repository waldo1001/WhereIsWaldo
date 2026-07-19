import Foundation

/// specs/004-ios-client.md §2.4 — the one I1 proof screen's state machine. Zero styling: only
/// plain state (an enum) that `SignInScreen` renders through design-system components.
public enum SignInState: Equatable {
    case idle
    case loading
    case signedIn(userId: String)
    case error(String)
}

@MainActor
public final class SignInViewModel: ObservableObject {
    @Published public private(set) var state: SignInState = .idle

    private let authProvider: AuthProviding
    private let onSignedIn: (() -> Void)?

    public init(authProvider: AuthProviding, onSignedIn: (() -> Void)? = nil) {
        self.authProvider = authProvider
        self.onSignedIn = onSignedIn
    }

    public func signIn() async {
        state = .loading
        do {
            _ = try await authProvider.currentIDToken()
            guard let userId = authProvider.currentUserId else {
                state = .error("Sign-in failed: no current user")
                return
            }
            state = .signedIn(userId: userId)
            onSignedIn?()
        } catch {
            state = .error("Sign-in failed: \(error)")
        }
    }

    /// The retry affordance — returns to `.idle` so the screen can offer the sign-in action again.
    public func reset() {
        state = .idle
    }
}
