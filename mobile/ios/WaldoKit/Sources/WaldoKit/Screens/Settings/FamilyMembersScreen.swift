import SwiftUI

/// specs/004-ios-client.md I2 (001 §3.2, §3.5–3.6) — composes ONLY design-system components. Role
/// toggle + remove actions are only shown for a parent viewer, and never for the viewer's own row.
public struct FamilyMembersScreen: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var viewModel: FamilyMembersViewModel

    public init(viewModel: FamilyMembersViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack(spacing: 0) {
            WaldoNavBar("Family")
            content
        }
        .background(theme.colors.surfaceVariant)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            LoadingStateView(message: "Loading family…")
        case .error(let message):
            ErrorStateView(message: message) {
                Task { await viewModel.load() }
            }
        case .loaded(let familyName, let me, let members):
            list(familyName: familyName, me: me, members: members)
        }
    }

    private func list(familyName: String, me: MeSummary, members: [FamilyMember]) -> some View {
        ScrollView {
            VStack(spacing: theme.spacing.md) {
                Text(familyName)
                    .font(theme.typography.titleLarge)
                    .foregroundColor(theme.colors.onSurface)
                if let lastActionError = viewModel.lastActionError {
                    ErrorStateView(message: lastActionError)
                }
                ForEach(members, id: \.userId) { member in
                    WaldoListRow(title: member.displayName, subtitle: member.role.capitalized) {
                        if viewModel.isParent && member.userId != me.userId {
                            HStack(spacing: theme.spacing.sm) {
                                WaldoButton(member.role == "parent" ? "Make member" : "Make parent", style: .secondary) {
                                    Task { await viewModel.updateRole(userId: member.userId, role: member.role == "parent" ? "member" : "parent") }
                                }
                                WaldoButton("Remove", style: .secondary) {
                                    Task { await viewModel.remove(userId: member.userId) }
                                }
                            }
                        }
                    }
                }
            }
            .padding(theme.spacing.md)
        }
    }
}
