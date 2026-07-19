import SwiftUI

/// specs/004-ios-client.md I2 (001 §4.2–4.3) — composes ONLY design-system components. Sync-
/// interval selection is a row of `WaldoButton` toggles (the allowed §1.4 values); pause is a
/// `WaldoToggleRow`. Both are hidden (read-only) for a non-parent viewer, matching §4.3's
/// parent-vs-owner permission split.
public struct DeviceSettingsScreen: View {
    @Environment(\.theme) private var theme
    @ObservedObject private var viewModel: DeviceSettingsViewModel

    public init(viewModel: DeviceSettingsViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack(spacing: 0) {
            WaldoNavBar("Devices")
            content
        }
        .background(theme.colors.surfaceVariant)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            LoadingStateView(message: "Loading devices…")
        case .error(let message):
            ErrorStateView(message: message) {
                Task { await viewModel.load() }
            }
        case .loaded(let devices):
            list(devices)
        }
    }

    private func list(_ devices: [DeviceListItem]) -> some View {
        ScrollView {
            VStack(spacing: theme.spacing.md) {
                if let lastActionError = viewModel.lastActionError {
                    ErrorStateView(message: lastActionError)
                }
                if devices.isEmpty {
                    EmptyStateView(title: "No devices yet", message: "Devices register automatically after sign-in.")
                } else {
                    ForEach(devices, id: \.deviceId) { device in
                        deviceCard(device)
                    }
                }
            }
            .padding(theme.spacing.md)
        }
    }

    private func deviceCard(_ device: DeviceListItem) -> some View {
        WaldoCard {
            VStack(alignment: .leading, spacing: theme.spacing.sm) {
                HStack {
                    Text(device.deviceName)
                        .font(theme.typography.titleMedium)
                        .foregroundColor(theme.colors.onSurface)
                    Spacer()
                    StatusChip(device.trackingEnabled ? "Active" : "Paused", kind: device.trackingEnabled ? .online : .paused)
                }
                Text("Owner: \(device.ownerDisplayName)")
                    .font(theme.typography.bodyMedium)
                    .foregroundColor(theme.colors.onSurface.opacity(0.7))
                if viewModel.isParent {
                    WaldoToggleRow(
                        title: "Tracking enabled",
                        isOn: Binding(
                            get: { device.trackingEnabled },
                            set: { newValue in Task { await viewModel.setTrackingEnabled(deviceId: device.deviceId, newValue) } }
                        )
                    )
                    intervalPicker(for: device)
                }
            }
        }
    }

    private func intervalPicker(for device: DeviceListItem) -> some View {
        VStack(alignment: .leading, spacing: theme.spacing.xs) {
            Text("Sync interval")
                .font(theme.typography.labelSmall)
                .foregroundColor(theme.colors.onSurface.opacity(0.7))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: theme.spacing.sm) {
                    ForEach(DeviceSettingsViewModel.allowedSyncIntervals, id: \.self) { minutes in
                        WaldoButton(label(for: minutes), style: minutes == device.syncIntervalMinutes ? .primary : .secondary) {
                            Task { await viewModel.setSyncInterval(deviceId: device.deviceId, minutes: minutes) }
                        }
                    }
                }
            }
        }
    }

    private func label(for minutes: Int) -> String {
        if minutes < 60 { return "\(minutes)m" }
        if minutes < 1440 { return "\(minutes / 60)h" }
        return "1d"
    }
}
