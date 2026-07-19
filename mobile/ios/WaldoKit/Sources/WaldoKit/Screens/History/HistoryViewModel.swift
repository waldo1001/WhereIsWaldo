import Foundation

/// specs/004-ios-client.md I2 (001 §5.3) — per-member/device history with date-range selection and
/// cursor pagination. A fresh `load()` resets pagination; `loadMore()` follows `nextCursor` until
/// the server signals exhaustion (`nextCursor == nil`).
@MainActor
public final class HistoryViewModel: ObservableObject {
    public enum State: Equatable {
        case idle
        case loading
        case loaded(points: [HistoryPoint], hasMore: Bool)
        case error(String)
    }

    @Published public private(set) var state: State = .idle
    @Published public private(set) var isLoadingMore = false

    public let userId: String
    public var deviceId: String?
    public var fromDate: String
    public var toDate: String

    private let apiClient: WaldoAPIClient
    private let pageSize: Int
    private var nextCursor: String?
    private var loadedPoints: [HistoryPoint] = []

    public init(apiClient: WaldoAPIClient, userId: String, deviceId: String? = nil, fromDate: String, toDate: String, pageSize: Int = 200) {
        self.apiClient = apiClient
        self.userId = userId
        self.deviceId = deviceId
        self.fromDate = fromDate
        self.toDate = toDate
        self.pageSize = pageSize
    }

    /// Fresh load for the current `userId`/`deviceId`/date range — always resets pagination, even
    /// if a previous load was mid-way through pages.
    public func load() async {
        state = .loading
        loadedPoints = []
        nextCursor = nil
        await fetchNextPage()
    }

    /// specs/001 §5.3 cursor pagination — a no-op if the previous page was exhausted, a load is
    /// already in flight, or `load()` hasn't successfully completed at least once.
    public func loadMore() async {
        guard case .loaded(_, let hasMore) = state, hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        await fetchNextPage()
    }

    private func fetchNextPage() async {
        do {
            let envelope = try await apiClient.getLocationHistory(
                userId: userId, deviceId: deviceId, from: fromDate, to: toDate, limit: pageSize, cursor: nextCursor
            )
            loadedPoints.append(contentsOf: envelope.data.points)
            nextCursor = envelope.data.nextCursor
            state = .loaded(points: loadedPoints, hasMore: nextCursor != nil)
        } catch {
            state = .error(userFacingMessage(for: error))
        }
    }
}
