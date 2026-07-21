import SwiftUI

/// specs/004-ios-client.md §3.4 (001 §12.3–12.9; 005 §2.3) — composes ONLY design-system
/// components (bar `ShareLink`/`DatePicker`, the same documented system-primitive exceptions used
/// by the invite/history screens). Rendering follows the 005 §2.3 lazy-enforcement matrix: `active`
/// shows the map entry point; roster is hidden for non-owner members during `ended` (grace);
/// rename/extend/rotate are owner-and-active/ended-only (archived groups reject PATCH, 001 §12.4);
/// kick/leave/delete stay available in every non-expired state, matching the matrix exactly.
public struct GroupDetailScreen: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var viewModel: GroupDetailViewModel
    @State private var editedName: String = ""
    @State private var extendedEndsAt: Date = Date().addingTimeInterval(24 * 3600)
    private let onSelectMap: () -> Void
    private let onExit: (GroupDetailViewModel.ExitReason) -> Void

    public init(
        viewModel: GroupDetailViewModel,
        onSelectMap: @escaping () -> Void,
        onExit: @escaping (GroupDetailViewModel.ExitReason) -> Void
    ) {
        self.viewModel = viewModel
        self.onSelectMap = onSelectMap
        self.onExit = onExit
    }

    public var body: some View {
        VStack(spacing: 0) {
            WaldoNavBar("Group")
            content
        }
        .background(theme.colors.surfaceVariant)
        .task { await viewModel.load() }
        .onChange(of: viewModel.exitReason) { reason in
            if let reason { onExit(reason) }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            LoadingStateView(message: "Loading group…")
        case .error(let message):
            ErrorStateView(message: message) {
                Task { await viewModel.load() }
            }
        case .loaded(let detail):
            detailView(detail)
        }
    }

    private func detailView(_ detail: GroupDetail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: theme.spacing.md) {
                header(detail)
                if let lastActionError = viewModel.lastActionError {
                    ErrorStateView(message: lastActionError)
                }
                if detail.state == "active" {
                    WaldoButton("Group map") { onSelectMap() }
                }
                if let code = detail.code {
                    shareCodeCard(code: code, name: detail.name)
                }
                rosterOrGraceNotice(detail)
                controls(detail)
            }
            .padding(theme.spacing.md)
        }
        .onAppear { editedName = detail.name }
    }

    private func header(_ detail: GroupDetail) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: theme.spacing.xs) {
                Text(detail.name)
                    .font(theme.typography.titleLarge)
                    .foregroundColor(theme.colors.onSurface)
                Text("\(detail.memberCount) member\(detail.memberCount == 1 ? "" : "s")")
                    .font(theme.typography.bodyMedium)
                    .foregroundColor(theme.colors.onSurface.opacity(0.7))
                Text(GroupCountdown.text(from: detail.endsAt))
                    .font(theme.typography.labelSmall)
                    .foregroundColor(theme.colors.onSurface.opacity(0.7))
            }
            Spacer()
            StatusChip(GroupStateChip.label(for: detail.state), kind: GroupStateChip.kind(for: detail.state))
        }
    }

    private func shareCodeCard(code: String, name: String) -> some View {
        WaldoCard {
            VStack(spacing: theme.spacing.sm) {
                Text(GroupDetailViewModel.shareText(for: code, groupName: name))
                    .font(theme.typography.titleMedium)
                    .foregroundColor(theme.colors.onSurface)
                    .multilineTextAlignment(.center)
                ShareLink(item: GroupDetailViewModel.shareText(for: code, groupName: name))
            }
        }
    }

    /// 005 §2.3: during `ended` (grace), non-owner members get no roster — only the owner sees it,
    /// to decide on reactivation. `archived` and `active` always carry the full roster.
    @ViewBuilder
    private func rosterOrGraceNotice(_ detail: GroupDetail) -> some View {
        if let members = detail.members {
            VStack(alignment: .leading, spacing: theme.spacing.sm) {
                ForEach(members, id: \.userId) { member in
                    WaldoListRow(title: member.displayName, subtitle: member.role.capitalized) {
                        if viewModel.isOwner && member.role != "owner" {
                            WaldoButton("Kick", style: .secondary) {
                                Task { await viewModel.kick(userId: member.userId) }
                            }
                        }
                    }
                }
            }
        } else {
            EmptyStateView(title: "This group has ended", message: "The owner can still reactivate it before it's deleted.")
        }
    }

    @ViewBuilder
    private func controls(_ detail: GroupDetail) -> some View {
        if viewModel.isOwner {
            ownerControls(detail)
        } else {
            WaldoButton("Leave group", style: .secondary) {
                Task { await viewModel.leave() }
            }
        }
    }

    /// PATCH-shaped controls (rename/extend/end-now) are hidden once `archived` — the server
    /// rejects PATCH there (`410 GROUP_EXPIRED`, 001 §12.4). Rotate only makes sense while `active`
    /// (the code row is gone otherwise, 005 §2.3). Kick/delete stay available in every state.
    @ViewBuilder
    private func ownerControls(_ detail: GroupDetail) -> some View {
        VStack(spacing: theme.spacing.sm) {
            if detail.state != "archived" {
                WaldoTextField("Group name", text: $editedName)
                WaldoButton("Rename", style: .secondary) {
                    Task { await viewModel.rename(name: editedName) }
                }
                DatePicker("New end date", selection: $extendedEndsAt, displayedComponents: [.date, .hourAndMinute])
                    .tint(theme.colors.primary)
                WaldoButton(detail.state == "ended" ? "Reactivate" : "Extend", style: .secondary) {
                    Task { await viewModel.extend(endsAt: extendedEndsAt) }
                }
                WaldoButton("End group now", style: .secondary) {
                    Task { await viewModel.endNow() }
                }
            }
            if detail.state == "active" {
                WaldoButton("Rotate code", style: .secondary) {
                    Task { await viewModel.rotateCode() }
                }
            }
            WaldoButton("Delete group", style: .secondary) {
                Task { await viewModel.deleteGroup() }
            }
        }
    }
}
