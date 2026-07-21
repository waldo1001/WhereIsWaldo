import Testing
@testable import WaldoKit

/// specs/004-ios-client.md §2.4, §9 — the one proof screen's view model. `.idle` → `.loading` on
/// submit → `.signedIn`/`.error`, and a retry affordance back to `.idle`. Contains zero styling.
@MainActor
struct SignInViewModelTests {

    @Test func initialState_isIdle() {
        let viewModel = SignInViewModel(authProvider: StubAuthProvider(currentUserId: "u1"))
        #expect(viewModel.state == .idle)
    }

    @Test func signIn_transitionsThroughLoading_toSignedIn() async throws {
        let auth = ControllableAuthProvider()
        auth.currentUserId = "u1"
        let viewModel = SignInViewModel(authProvider: auth)

        let task = Task { await viewModel.signIn() }
        try await waitUntil { viewModel.state == .loading }

        auth.resume(with: .success("stub-token"))
        _ = await task.value

        #expect(viewModel.state == .signedIn(userId: "u1"))
    }

    @Test func signIn_failure_transitionsToError() async throws {
        let auth = ControllableAuthProvider()
        auth.currentUserId = "u1"
        let viewModel = SignInViewModel(authProvider: auth)

        let task = Task { await viewModel.signIn() }
        try await waitUntil { viewModel.state == .loading }

        struct SomeAuthFailure: Error {}
        auth.resume(with: .failure(SomeAuthFailure()))
        _ = await task.value

        guard case .error = viewModel.state else {
            Issue.record("expected .error state, got \(viewModel.state)")
            return
        }
    }

    @Test func reset_returnsToIdleFromError() async throws {
        // StubAuthProvider throws AuthError.notSignedIn immediately when there's no current user
        // (no continuation to resume, unlike ControllableAuthProvider) — a convenient way to
        // reach `.error` without needing to drive a separate resuming Task.
        let viewModel = SignInViewModel(authProvider: StubAuthProvider(currentUserId: nil))

        await viewModel.signIn()
        guard case .error = viewModel.state else {
            Issue.record("expected .error state before reset")
            return
        }

        viewModel.reset()
        #expect(viewModel.state == .idle)
    }
}

/// A controllable `AuthProviding` whose `currentIDToken()` suspends until `resume(with:)` is
/// called — lets tests observe the `.loading` state deterministically instead of racing a real
/// async call.
final class ControllableAuthProvider: AuthProviding {
    var currentUserId: String?
    private var continuation: CheckedContinuation<String, Error>?

    func currentIDToken() async throws -> String {
        try await withCheckedThrowingContinuation { self.continuation = $0 }
    }

    func refreshIDToken() async throws -> String {
        try await currentIDToken()
    }

    func signOut() throws {
        currentUserId = nil
    }

    func startPhoneVerification(phoneNumberE164: String) async throws {}

    func confirmCode(_ code: String) async throws {}

    func resume(with result: Result<String, Error>) {
        continuation?.resume(with: result)
        continuation = nil
    }
}
