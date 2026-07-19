import SwiftUI

/// specs/004-ios-client.md §2.4 — the one I1 proof screen. Composes ONLY design-system components
/// (`WaldoNavBar`, `WaldoButton`, `LoadingStateView`, `EmptyStateView`, `ErrorStateView`) and reads
/// state from `SignInViewModel`; contains no styling of its own beyond generic layout.
public struct SignInScreen: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var viewModel: SignInViewModel

    public init(viewModel: SignInViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack(spacing: theme.spacing.lg) {
            WaldoNavBar("Where's waldo")
            Spacer()
            content
            Spacer()
        }
        .background(theme.colors.surfaceVariant)
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            WaldoButton("Sign in") {
                Task { await viewModel.signIn() }
            }
            .padding(.horizontal, theme.spacing.xl)
        case .loading:
            LoadingStateView(message: "Signing in…")
        case .signedIn:
            EmptyStateView(title: "Signed in", message: "Welcome to Where's waldo.")
        case .error(let message):
            ErrorStateView(message: message) {
                viewModel.reset()
            }
        }
    }
}
