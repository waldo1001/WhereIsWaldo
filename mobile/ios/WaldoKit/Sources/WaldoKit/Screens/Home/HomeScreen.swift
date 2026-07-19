import SwiftUI

/// specs/004-ios-client.md I2 — the post-sign-in navigation hub, composed ONLY from design-system
/// components. Navigation itself is the caller's responsibility (closures), matching the
/// `AppCoordinator` seam already established by I1's `SignInScreen`.
public struct HomeScreen: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var viewModel: HomeViewModel
    private let onSelectMap: () -> Void
    private let onSelectHistory: (String) -> Void
    private let onSelectGeofences: () -> Void
    private let onSelectLocate: (LocateTarget, String) -> Void
    private let onSelectDevices: (Bool) -> Void
    private let onSelectFamily: () -> Void
    private let onSelectInvite: () -> Void

    public init(
        viewModel: HomeViewModel,
        onSelectMap: @escaping () -> Void,
        onSelectHistory: @escaping (String) -> Void,
        onSelectGeofences: @escaping () -> Void,
        onSelectLocate: @escaping (LocateTarget, String) -> Void,
        onSelectDevices: @escaping (Bool) -> Void,
        onSelectFamily: @escaping () -> Void,
        onSelectInvite: @escaping () -> Void
    ) {
        self.viewModel = viewModel
        self.onSelectMap = onSelectMap
        self.onSelectHistory = onSelectHistory
        self.onSelectGeofences = onSelectGeofences
        self.onSelectLocate = onSelectLocate
        self.onSelectDevices = onSelectDevices
        self.onSelectFamily = onSelectFamily
        self.onSelectInvite = onSelectInvite
    }

    public var body: some View {
        VStack(spacing: 0) {
            WaldoNavBar("Where's waldo")
            content
        }
        .background(theme.colors.surfaceVariant)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            LoadingStateView(message: "Loading your family…")
        case .error(let message):
            ErrorStateView(message: message) {
                Task { await viewModel.load() }
            }
        case .loaded(let myUserId, let isParent, let familyName, let otherMembers):
            ScrollView {
                VStack(spacing: theme.spacing.md) {
                    Text(familyName)
                        .font(theme.typography.titleLarge)
                        .foregroundColor(theme.colors.onSurface)
                    WaldoButton("Family map") { onSelectMap() }
                    WaldoButton("My history", style: .secondary) { onSelectHistory(myUserId) }
                    WaldoButton("Geofences", style: .secondary) { onSelectGeofences() }
                    if let first = otherMembers.first {
                        WaldoButton("Locate \(first.displayName)", style: .secondary) {
                            onSelectLocate(.user(first.userId), first.displayName)
                        }
                    }
                    WaldoButton("Devices", style: .secondary) { onSelectDevices(isParent) }
                    WaldoButton("Family members", style: .secondary) { onSelectFamily() }
                    if isParent {
                        WaldoButton("Invite someone", style: .secondary) { onSelectInvite() }
                    }
                }
                .padding(theme.spacing.xl)
            }
        }
    }
}
