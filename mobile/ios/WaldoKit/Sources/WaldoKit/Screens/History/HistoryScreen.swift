import SwiftUI

/// specs/004-ios-client.md I2 (001 §5.3) — composes ONLY design-system components. Date-range
/// selection uses the system `DatePicker` (tinted via `theme.colors.primary`, never a literal
/// color); pagination is a plain "Load more" `WaldoButton` driven by the view model's cursor state.
public struct HistoryScreen: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var viewModel: HistoryViewModel

    public init(viewModel: HistoryViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack(spacing: 0) {
            WaldoNavBar("History")
            content
        }
        .background(theme.colors.surfaceVariant)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading:
            LoadingStateView(message: "Loading history…")
        case .error(let message):
            ErrorStateView(message: message) {
                Task { await viewModel.load() }
            }
        case .loaded(let points, let hasMore):
            list(points: points, hasMore: hasMore)
        }
    }

    private func list(points: [HistoryPoint], hasMore: Bool) -> some View {
        ScrollView {
            VStack(spacing: theme.spacing.sm) {
                if points.isEmpty {
                    EmptyStateView(title: "No history", message: "No locations recorded in this date range.")
                } else {
                    ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                        WaldoListRow(title: "\(point.lat), \(point.lon)", subtitle: point.recordedAt) {
                            StatusChip(point.source.rawValue.capitalized, kind: .online)
                        }
                    }
                    if hasMore {
                        WaldoButton(viewModel.isLoadingMore ? "Loading…" : "Load more", style: .secondary) {
                            Task { await viewModel.loadMore() }
                        }
                        .disabled(viewModel.isLoadingMore)
                    }
                }
            }
            .padding(theme.spacing.md)
        }
    }
}
