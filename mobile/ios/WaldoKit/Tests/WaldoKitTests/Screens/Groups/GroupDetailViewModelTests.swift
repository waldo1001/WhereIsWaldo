import Foundation
import Testing
@testable import WaldoKit

/// specs/004-ios-client.md §3.4 (001 §12.3–12.9; 005 §2.3) — group detail: roster, share code,
/// owner controls (rename/extend/rotate/kick/delete) and member self-service (leave). `GROUP_EXPIRED`
/// surfacing anywhere here sets `exitReason = .expired` so the screen can bounce back to the groups
/// list (005 §2.3's lazy-enforcement matrix — the same pattern `GeofencesViewModel` uses for its
/// version-conflict re-fetch, but here the "recovery" is leaving the screen, not merging).
@MainActor
struct GroupDetailViewModelTests {

    func makeDetail(role: String = "owner", state: String = "active", members: [GroupMember]? = nil) -> GroupDetail {
        GroupDetail(
            groupId: "grp_1", name: "Festival crew", endsAt: "2026-08-02T22:00:00Z", expiryPolicy: "delete",
            state: state, role: role, memberCount: 2, code: "7F3K9QRZ", createdAt: "2026-07-21T10:00:00Z",
            members: members ?? [
                GroupMember(userId: "u1", displayName: "Eric", role: "owner", joinedAt: "2026-07-21T10:00:00Z"),
                GroupMember(userId: "u2", displayName: "Noor", role: "member", joinedAt: "2026-07-21T10:05:00Z"),
            ]
        )
    }

    @Test func load_success_populatesState() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { groupId in
            #expect(groupId == "grp_1")
            return TestFeatures.envelope(self.makeDetail())
        }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")

        await viewModel.load()

        #expect(viewModel.state == .loaded(makeDetail()))
        #expect(viewModel.isOwner == true)
    }

    @Test func load_memberRole_derivesIsOwnerFalse() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { _ in TestFeatures.envelope(self.makeDetail(role: "member")) }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")

        await viewModel.load()

        #expect(viewModel.isOwner == false)
    }

    @Test func load_groupExpired_setsExitReasonExpired() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { _ in
            throw APIError.server(APIErrorBody(code: .groupExpired, message: "expired", details: nil, requestId: "r1"), httpStatus: 410)
        }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")

        await viewModel.load()

        #expect(viewModel.exitReason == .expired)
    }

    @Test func load_otherFailure_setsErrorState() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { _ in
            throw APIError.server(APIErrorBody(code: .groupNotFound, message: "not found", details: nil, requestId: "r1"), httpStatus: 404)
        }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")

        await viewModel.load()

        guard case .error = viewModel.state else {
            Issue.record("expected .error state, got \(viewModel.state)")
            return
        }
    }

    @Test func rename_updatesNameInPlace_sendsNilEndsAt() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { _ in TestFeatures.envelope(self.makeDetail()) }
        api.updateGroupHandler = { groupId, name, endsAt in
            #expect(groupId == "grp_1")
            #expect(name == "Festival crew 2026")
            #expect(endsAt == nil)
            return TestFeatures.envelope(GroupSummary(
                groupId: "grp_1", name: "Festival crew 2026", endsAt: "2026-08-02T22:00:00Z", expiryPolicy: "delete",
                state: "active", role: "owner", memberCount: 2, code: "7F3K9QRZ", createdAt: nil
            ))
        }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")
        await viewModel.load()

        await viewModel.rename(name: "Festival crew 2026")

        guard case .loaded(let detail) = viewModel.state else {
            Issue.record("expected .loaded state")
            return
        }
        #expect(detail.name == "Festival crew 2026")
        #expect(detail.members?.count == 2, "roster must be preserved across a summary-shaped mutation response")
        #expect(viewModel.lastActionError == nil)
    }

    @Test func extend_sendsFormattedEndsAt_sendsNilName() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { _ in TestFeatures.envelope(self.makeDetail(state: "ended")) }
        let newEndsAt = ISO8601DateFormatter().date(from: "2026-08-03T22:00:00Z")!
        api.updateGroupHandler = { groupId, name, endsAt in
            #expect(name == nil)
            #expect(endsAt == "2026-08-03T22:00:00Z")
            return TestFeatures.envelope(GroupSummary(
                groupId: "grp_1", name: "Festival crew", endsAt: "2026-08-03T22:00:00Z", expiryPolicy: "delete",
                state: "active", role: "owner", memberCount: 2, code: "7F3K9QRZ", createdAt: nil
            ))
        }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")
        await viewModel.load()

        await viewModel.extend(endsAt: newEndsAt)

        guard case .loaded(let detail) = viewModel.state else {
            Issue.record("expected .loaded state")
            return
        }
        #expect(detail.state == "active", "extending a grace-state group reactivates it (005 §2.2)")
    }

    @Test func rotateCode_updatesCodeButPreservesRoster() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { _ in TestFeatures.envelope(self.makeDetail()) }
        api.rotateGroupCodeHandler = { groupId in
            #expect(groupId == "grp_1")
            return TestFeatures.envelope(RotateGroupCodeResponse(code: "9XPT4WKA", rotatedAt: "2026-07-21T10:05:00Z"))
        }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")
        await viewModel.load()

        await viewModel.rotateCode()

        guard case .loaded(let detail) = viewModel.state else {
            Issue.record("expected .loaded state")
            return
        }
        #expect(detail.code == "9XPT4WKA")
        #expect(detail.members?.count == 2)
    }

    @Test func kick_removesMemberAndDecrementsCount() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { _ in TestFeatures.envelope(self.makeDetail()) }
        api.removeGroupMemberHandler = { groupId, userId in
            #expect(groupId == "grp_1")
            #expect(userId == "u2")
        }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")
        await viewModel.load()

        await viewModel.kick(userId: "u2")

        guard case .loaded(let detail) = viewModel.state else {
            Issue.record("expected .loaded state")
            return
        }
        #expect(detail.members?.map(\.userId) == ["u1"])
        #expect(detail.memberCount == 1)
    }

    @Test func leave_success_setsExitReasonLeft() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { _ in TestFeatures.envelope(self.makeDetail(role: "member")) }
        api.leaveGroupHandler = { groupId in #expect(groupId == "grp_1") }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")
        await viewModel.load()

        await viewModel.leave()

        #expect(viewModel.exitReason == .left)
    }

    @Test func leave_ownerRejection_surfacesActionErrorNotExit() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { _ in TestFeatures.envelope(self.makeDetail(role: "owner")) }
        api.leaveGroupHandler = { _ in
            throw APIError.server(APIErrorBody(code: .validationFailed, message: "owner cannot leave", details: ["reason": .string("ownerCannotLeave")], requestId: "r1"), httpStatus: 400)
        }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")
        await viewModel.load()

        await viewModel.leave()

        #expect(viewModel.exitReason == nil)
        #expect(viewModel.lastActionError != nil)
    }

    @Test func deleteGroup_success_setsExitReasonDeleted() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { _ in TestFeatures.envelope(self.makeDetail()) }
        api.deleteGroupHandler = { groupId in #expect(groupId == "grp_1") }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")
        await viewModel.load()

        await viewModel.deleteGroup()

        #expect(viewModel.exitReason == .deleted)
    }

    @Test func mutation_groupExpiredMidAction_setsExitReasonExpired() async {
        let api = FakeAPIClient()
        api.getGroupHandler = { _ in TestFeatures.envelope(self.makeDetail()) }
        api.updateGroupHandler = { _, _, _ in
            throw APIError.server(APIErrorBody(code: .groupExpired, message: "expired", details: nil, requestId: "r1"), httpStatus: 410)
        }
        let viewModel = GroupDetailViewModel(apiClient: api, groupId: "grp_1")
        await viewModel.load()

        await viewModel.rename(name: "New name")

        #expect(viewModel.exitReason == .expired)
    }

    @Test func shareText_formatsCodeAsHyphenatedGroupsAndIncludesGroupName() {
        let text = GroupDetailViewModel.shareText(for: "7f3k9qrz", groupName: "Festival crew")
        #expect(text.contains("7F3K-9QRZ"))
        #expect(text.contains("Festival crew"))
    }
}
