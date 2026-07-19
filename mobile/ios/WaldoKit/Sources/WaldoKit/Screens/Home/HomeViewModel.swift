import Foundation

/// specs/004-ios-client.md I2 — the post-sign-in hub. Loads just enough family context
/// (`GET /families/me`) to know the caller's role (parent vs member) and offer sensible defaults
/// (own history, first other member to locate), so individual feature screens don't each need to
/// re-derive this.
@MainActor
public final class HomeViewModel: ObservableObject {
    public enum State: Equatable {
        case loading
        case loaded(myUserId: String, isParent: Bool, familyName: String, otherMembers: [FamilyMember])
        case error(String)
    }

    @Published public private(set) var state: State = .loading
    private let apiClient: WaldoAPIClient

    public init(apiClient: WaldoAPIClient) {
        self.apiClient = apiClient
    }

    public func load() async {
        state = .loading
        do {
            let envelope = try await apiClient.getMyFamily()
            let others = envelope.data.members.filter { $0.userId != envelope.data.me.userId }
            state = .loaded(
                myUserId: envelope.data.me.userId,
                isParent: envelope.data.me.role == "parent",
                familyName: envelope.data.familyName,
                otherMembers: others
            )
        } catch {
            state = .error(userFacingMessage(for: error))
        }
    }
}
