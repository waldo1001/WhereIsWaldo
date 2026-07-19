import SwiftUI
import WaldoKit

/// The composition root — the ONLY place that resolves `.light`/`.dark` from the system
/// `colorScheme` and injects `\.theme` (specs/004-ios-client.md §2.2). Everything below this reads
/// `\.theme`, never `colorScheme` directly. Also the ONLY place that constructs the `AuthProviding`
/// implementation — swapping `StubAuthProvider` for `FirebaseAuthProvider` once H1 lands
/// (specs/004 §4, §8) touches only this one line.
struct RootView: View {
    @Environment(\.colorScheme) private var colorScheme
    @ObservedObject var coordinator: AppCoordinator

    // H1 follow-up: real Firebase Auth SDK + GoogleService-Info.plist. Until then, the app runs
    // against AppConfig.default's AuthMode.stubLocal, matching the backend's
    // AUTH_MODE=insecure-local (specs/001 §2.3).
    private let authProvider: AuthProviding = StubAuthProvider()

    var body: some View {
        Group {
            switch coordinator.route {
            case .signIn:
                SignInScreen(
                    viewModel: SignInViewModel(authProvider: authProvider, onSignedIn: {
                        coordinator.showHome()
                    })
                )
            case .home:
                // I2 builds the real home/map screen; this placeholder proves the route seam
                // works end to end through the design system.
                EmptyStateView(title: "Signed in", message: "Feature screens land in I2.")
            }
        }
        .environment(\.theme, colorScheme == .dark ? .dark : .light)
    }
}
