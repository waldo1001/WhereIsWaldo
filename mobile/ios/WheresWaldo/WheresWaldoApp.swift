import SwiftUI
import WaldoKit

/// specs/004-ios-client.md §1.1 — the thin app target's ONLY job is App-lifecycle wiring. All logic
/// and the design system live in `WaldoKit`. This file must stay this small: scene setup and
/// nothing else.
@main
struct WheresWaldoApp: App {
    @StateObject private var coordinator = AppCoordinator()

    var body: some Scene {
        WindowGroup {
            RootView(coordinator: coordinator)
                // specs/004-ios-client.md §3.4 — the group-join deep link
                // (waldo://group-join?code=…) is parsed/validated in WaldoKit
                // (AppCoordinator.handleDeepLink, backed by the pure GroupCodeParsing); this is
                // just the OS-lifecycle forwarding, the one piece of "logic" the app target is
                // allowed (specs/004 §1.1).
                .onOpenURL { url in coordinator.handleDeepLink(url) }
        }
    }
}
