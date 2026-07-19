import Foundation

/// specs/001-api-contract.md §1.3 — every success response body.
public struct Envelope<T: Decodable>: Decodable {
    public let data: T
    public let features: Features
}

/// specs/001-api-contract.md §9 — present in every success envelope; derived server-side only
/// from `PLAN_MATRIX`. Clients never send entitlement data, only read this object.
public struct Features: Decodable, Equatable {
    public let subscriptionStatus: String
    public let limits: PlanLimits
    public let flags: PlanFlags
}

public struct PlanLimits: Decodable, Equatable {
    public let maxDevices: Int
    public let maxGeofences: Int
    public let historyDays: Int
    public let minSyncIntervalMinutes: Int
    public let locateRequestsPerDay: Int
}

public struct PlanFlags: Decodable, Equatable {
    public let pushToLocate: Bool
    public let geofencing: Bool
    public let historyReplay: Bool
}

/// specs/001-api-contract.md §1.3, §10 — every error response body.
public struct APIErrorBody: Decodable, Equatable {
    public let code: APIErrorCode
    public let message: String
    public let details: [String: JSONValue]?
    public let requestId: String
}

public struct APIErrorEnvelope: Decodable, Equatable {
    public let error: APIErrorBody
}

/// Thrown by `WaldoAPIClient` implementations when the server returns a non-2xx response that
/// decodes as `APIErrorEnvelope`, or when the response cannot be understood at all.
public enum APIError: Error, Equatable {
    case server(APIErrorBody, httpStatus: Int)
    case notModified
    case transport(String)
    case decoding(String)
}
