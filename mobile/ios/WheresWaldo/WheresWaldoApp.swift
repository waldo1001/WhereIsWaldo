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
        }
    }
}
