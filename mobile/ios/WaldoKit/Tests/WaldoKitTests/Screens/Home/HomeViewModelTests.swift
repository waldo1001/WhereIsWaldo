import Testing
@testable import WaldoKit

/// specs/004-ios-client.md I2 — the post-sign-in hub's family-context load.
@MainActor
struct HomeViewModelTests {

    @Test func load_success_excludesSelfFromOtherMembers() async {
        let api = FakeAPIClient()
        api.getMyFamilyHandler = {
            TestFeatures.envelope(GetMyFamilyResponse(
                familyId: "fam_x", familyName: "Wauters", createdAt: "2026-07-19T08:00:00Z",
                me: MeSummary(userId: "u1", role: "parent"),
                members: [
                    FamilyMember(userId: "u1", role: "parent", displayName: "Eric", joinedAt: "2026-07-19T08:00:00Z"),
                    FamilyMember(userId: "u2", role: "member", displayName: "Noor", joinedAt: "2026-07-19T08:01:00Z"),
                ]
            ))
        }
        let viewModel = HomeViewModel(apiClient: api)

        await viewModel.load()

        guard case .loaded(let myUserId, let isParent, let familyName, let otherMembers) = viewModel.state else {
            Issue.record("expected .loaded state, got \(viewModel.state)")
            return
        }
        #expect(myUserId == "u1")
        #expect(isParent == true)
        #expect(familyName == "Wauters")
        #expect(otherMembers.map(\.userId) == ["u2"])
    }

    @Test func load_failure_setsErrorState() async {
        let api = FakeAPIClient()
        api.getMyFamilyHandler = { throw APIError.transport("offline") }
        let viewModel = HomeViewModel(apiClient: api)

        await viewModel.load()

        guard case .error = viewModel.state else {
            Issue.record("expected .error state, got \(viewModel.state)")
            return
        }
    }
}
