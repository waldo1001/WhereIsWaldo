import Testing
@testable import WaldoKit

/// specs/004-ios-client.md I2 (001 §3.2, §3.5–3.6) — family roster + member management,
/// parent-only mutations derived from the server's own `me.role`.
@MainActor
struct FamilyMembersViewModelTests {

    func makeFamilyEnvelope(myRole: String = "parent") -> Envelope<GetMyFamilyResponse> {
        TestFeatures.envelope(GetMyFamilyResponse(
            familyId: "fam_x", familyName: "Wauters", createdAt: "2026-07-19T08:00:00Z",
            me: MeSummary(userId: "u1", role: myRole),
            members: [
                FamilyMember(userId: "u1", role: myRole, displayName: "Eric", joinedAt: "2026-07-19T08:00:00Z"),
                FamilyMember(userId: "u2", role: "member", displayName: "Noor", joinedAt: "2026-07-19T08:01:00Z"),
            ]
        ))
    }

    @Test func load_asParent_derivesIsParentTrue() async {
        let api = FakeAPIClient()
        api.getMyFamilyHandler = { self.makeFamilyEnvelope(myRole: "parent") }
        let viewModel = FamilyMembersViewModel(apiClient: api)

        await viewModel.load()

        #expect(viewModel.isParent == true)
    }

    @Test func load_asMember_derivesIsParentFalse() async {
        let api = FakeAPIClient()
        api.getMyFamilyHandler = { self.makeFamilyEnvelope(myRole: "member") }
        let viewModel = FamilyMembersViewModel(apiClient: api)

        await viewModel.load()

        #expect(viewModel.isParent == false)
    }

    @Test func updateRole_asParent_updatesTheMatchingMemberInPlace() async {
        let api = FakeAPIClient()
        api.getMyFamilyHandler = { self.makeFamilyEnvelope() }
        api.updateMemberHandler = { userId, role, _ in
            #expect(userId == "u2")
            #expect(role == "parent")
            return TestFeatures.envelope(FamilyMember(userId: "u2", role: "parent", displayName: "Noor", joinedAt: "2026-07-19T08:01:00Z"))
        }
        let viewModel = FamilyMembersViewModel(apiClient: api)
        await viewModel.load()

        await viewModel.updateRole(userId: "u2", role: "parent")

        guard case .loaded(_, _, let members) = viewModel.state else {
            Issue.record("expected .loaded state")
            return
        }
        #expect(members.first { $0.userId == "u2" }?.role == "parent")
        #expect(viewModel.lastActionError == nil)
    }

    @Test func remove_asNonParent_isRejectedWithoutCallingTheApi() async {
        let api = FakeAPIClient()
        api.getMyFamilyHandler = { self.makeFamilyEnvelope(myRole: "member") }
        let viewModel = FamilyMembersViewModel(apiClient: api)
        await viewModel.load()

        await viewModel.remove(userId: "u2")

        #expect(api.removeMemberCalls.isEmpty)
        #expect(viewModel.lastActionError != nil)
    }

    @Test func remove_asParent_removesTheMemberFromTheList() async {
        let api = FakeAPIClient()
        api.getMyFamilyHandler = { self.makeFamilyEnvelope() }
        api.removeMemberHandler = { userId in #expect(userId == "u2") }
        let viewModel = FamilyMembersViewModel(apiClient: api)
        await viewModel.load()

        await viewModel.remove(userId: "u2")

        guard case .loaded(_, _, let members) = viewModel.state else {
            Issue.record("expected .loaded state")
            return
        }
        #expect(members.map(\.userId) == ["u1"])
    }

    @Test func remove_lastParentRejection_surfacesErrorWithoutMutatingList() async {
        let api = FakeAPIClient()
        api.getMyFamilyHandler = { self.makeFamilyEnvelope() }
        api.removeMemberHandler = { _ in
            throw APIError.server(APIErrorBody(code: .validationFailed, message: "last parent", details: nil, requestId: "r1"), httpStatus: 400)
        }
        let viewModel = FamilyMembersViewModel(apiClient: api)
        await viewModel.load()

        await viewModel.remove(userId: "u1")

        #expect(viewModel.lastActionError != nil)
        guard case .loaded(_, _, let members) = viewModel.state else {
            Issue.record("expected .loaded state")
            return
        }
        #expect(members.map(\.userId) == ["u1", "u2"])
    }
}
