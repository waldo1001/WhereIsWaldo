import Testing
@testable import WaldoKit

/// specs/004-ios-client.md I2 (001 §5.3) — date-range history with cursor pagination.
@MainActor
struct HistoryViewModelTests {

    func makePoint(_ recordedAt: String) -> HistoryPoint {
        HistoryPoint(deviceId: "d1", recordedAt: recordedAt, lat: 51.0, lon: 3.7, accuracyM: 10, batteryPct: 80, source: .periodic)
    }

    @Test func initialState_isIdle() {
        let viewModel = HistoryViewModel(apiClient: FakeAPIClient(), userId: "u1", fromDate: "2026-07-01", toDate: "2026-07-19")
        #expect(viewModel.state == .idle)
    }

    @Test func load_singlePage_hasMoreFalseWhenCursorIsNil() async {
        let api = FakeAPIClient()
        api.getLocationHistoryHandler = { _, _, _, _, _, _ in
            TestFeatures.envelope(LocationHistoryResponse(points: [self.makePoint("2026-07-19T09:00:00Z")], nextCursor: nil))
        }
        let viewModel = HistoryViewModel(apiClient: api, userId: "u1", fromDate: "2026-07-01", toDate: "2026-07-19")

        await viewModel.load()

        #expect(viewModel.state == .loaded(points: [makePoint("2026-07-19T09:00:00Z")], hasMore: false))
        #expect(api.getLocationHistoryCalls.count == 1)
        #expect(api.getLocationHistoryCalls.first?.cursor == nil)
    }

    @Test func loadMore_followsTheReturnedCursor_andAppendsPoints() async {
        let api = FakeAPIClient()
        var callIndex = 0
        api.getLocationHistoryHandler = { _, _, _, _, _, cursor in
            callIndex += 1
            if callIndex == 1 {
                #expect(cursor == nil)
                return TestFeatures.envelope(LocationHistoryResponse(points: [self.makePoint("2026-07-19T09:00:00Z")], nextCursor: "page2"))
            } else {
                #expect(cursor == "page2")
                return TestFeatures.envelope(LocationHistoryResponse(points: [self.makePoint("2026-07-19T10:00:00Z")], nextCursor: nil))
            }
        }
        let viewModel = HistoryViewModel(apiClient: api, userId: "u1", fromDate: "2026-07-01", toDate: "2026-07-19")

        await viewModel.load()
        #expect(viewModel.state == .loaded(points: [makePoint("2026-07-19T09:00:00Z")], hasMore: true))

        await viewModel.loadMore()

        #expect(viewModel.state == .loaded(points: [makePoint("2026-07-19T09:00:00Z"), makePoint("2026-07-19T10:00:00Z")], hasMore: false))
        #expect(api.getLocationHistoryCalls.count == 2)
    }

    @Test func loadMore_isNoOp_whenNoMorePagesRemain() async {
        let api = FakeAPIClient()
        api.getLocationHistoryHandler = { _, _, _, _, _, _ in
            TestFeatures.envelope(LocationHistoryResponse(points: [], nextCursor: nil))
        }
        let viewModel = HistoryViewModel(apiClient: api, userId: "u1", fromDate: "2026-07-01", toDate: "2026-07-19")

        await viewModel.load()
        await viewModel.loadMore()

        #expect(api.getLocationHistoryCalls.count == 1, "loadMore must not call the API once hasMore is false")
    }

    @Test func load_resetsPagination_onASecondFreshLoad() async {
        let api = FakeAPIClient()
        var callIndex = 0
        api.getLocationHistoryHandler = { _, _, _, _, _, cursor in
            callIndex += 1
            if callIndex == 1 {
                return TestFeatures.envelope(LocationHistoryResponse(points: [self.makePoint("2026-07-19T09:00:00Z")], nextCursor: "page2"))
            } else {
                // The second top-level load() must start over with cursor: nil, not resume page2.
                #expect(cursor == nil)
                return TestFeatures.envelope(LocationHistoryResponse(points: [self.makePoint("2026-08-01T09:00:00Z")], nextCursor: nil))
            }
        }
        let viewModel = HistoryViewModel(apiClient: api, userId: "u1", fromDate: "2026-07-01", toDate: "2026-07-19")
        await viewModel.load()

        viewModel.fromDate = "2026-08-01"
        viewModel.toDate = "2026-08-01"
        await viewModel.load()

        #expect(viewModel.state == .loaded(points: [makePoint("2026-08-01T09:00:00Z")], hasMore: false))
    }

    @Test func load_failure_setsErrorState() async {
        let api = FakeAPIClient()
        api.getLocationHistoryHandler = { _, _, _, _, _, _ in
            throw APIError.server(APIErrorBody(code: .validationFailed, message: "beyond retention", details: nil, requestId: "r1"), httpStatus: 400)
        }
        let viewModel = HistoryViewModel(apiClient: api, userId: "u1", fromDate: "2020-01-01", toDate: "2020-01-31")

        await viewModel.load()

        guard case .error = viewModel.state else {
            Issue.record("expected .error state, got \(viewModel.state)")
            return
        }
    }
}
