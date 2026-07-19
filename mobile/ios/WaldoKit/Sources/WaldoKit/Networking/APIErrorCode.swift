import Foundation

/// The complete, closed error-code catalog of specs/001-api-contract.md §10 (21 codes) — codes may
/// not be invented elsewhere (specs/README.md). `.unknown` is a defensive, forward-compatible
/// fallback only: a conforming server per §10 never actually sends it.
public enum APIErrorCode: Equatable, Hashable {
    case authMissingToken
    case authInvalidToken
    case authTokenExpired
    case authForbidden
    case trackingPaused
    case familyNotFound
    case memberNotFound
    case deviceNotFound
    case locateRequestNotFound
    case familyAlreadyMember
    case geofenceVersionConflict
    case inviteExpired
    case locateRequestExpired
    case inviteInvalid
    case inviteAlreadyUsed
    case validationFailed
    case locationBatchTooLarge
    case limitExceeded
    case rateLimited
    case internalError
    case pushDeliveryFailed
    case unknown(String)

    public init(rawValue: String) {
        switch rawValue {
        case "AUTH_MISSING_TOKEN": self = .authMissingToken
        case "AUTH_INVALID_TOKEN": self = .authInvalidToken
        case "AUTH_TOKEN_EXPIRED": self = .authTokenExpired
        case "AUTH_FORBIDDEN": self = .authForbidden
        case "TRACKING_PAUSED": self = .trackingPaused
        case "FAMILY_NOT_FOUND": self = .familyNotFound
        case "MEMBER_NOT_FOUND": self = .memberNotFound
        case "DEVICE_NOT_FOUND": self = .deviceNotFound
        case "LOCATE_REQUEST_NOT_FOUND": self = .locateRequestNotFound
        case "FAMILY_ALREADY_MEMBER": self = .familyAlreadyMember
        case "GEOFENCE_VERSION_CONFLICT": self = .geofenceVersionConflict
        case "INVITE_EXPIRED": self = .inviteExpired
        case "LOCATE_REQUEST_EXPIRED": self = .locateRequestExpired
        case "INVITE_INVALID": self = .inviteInvalid
        case "INVITE_ALREADY_USED": self = .inviteAlreadyUsed
        case "VALIDATION_FAILED": self = .validationFailed
        case "LOCATION_BATCH_TOO_LARGE": self = .locationBatchTooLarge
        case "LIMIT_EXCEEDED": self = .limitExceeded
        case "RATE_LIMITED": self = .rateLimited
        case "INTERNAL_ERROR": self = .internalError
        case "PUSH_DELIVERY_FAILED": self = .pushDeliveryFailed
        default: self = .unknown(rawValue)
        }
    }

    public var rawValue: String {
        switch self {
        case .authMissingToken: return "AUTH_MISSING_TOKEN"
        case .authInvalidToken: return "AUTH_INVALID_TOKEN"
        case .authTokenExpired: return "AUTH_TOKEN_EXPIRED"
        case .authForbidden: return "AUTH_FORBIDDEN"
        case .trackingPaused: return "TRACKING_PAUSED"
        case .familyNotFound: return "FAMILY_NOT_FOUND"
        case .memberNotFound: return "MEMBER_NOT_FOUND"
        case .deviceNotFound: return "DEVICE_NOT_FOUND"
        case .locateRequestNotFound: return "LOCATE_REQUEST_NOT_FOUND"
        case .familyAlreadyMember: return "FAMILY_ALREADY_MEMBER"
        case .geofenceVersionConflict: return "GEOFENCE_VERSION_CONFLICT"
        case .inviteExpired: return "INVITE_EXPIRED"
        case .locateRequestExpired: return "LOCATE_REQUEST_EXPIRED"
        case .inviteInvalid: return "INVITE_INVALID"
        case .inviteAlreadyUsed: return "INVITE_ALREADY_USED"
        case .validationFailed: return "VALIDATION_FAILED"
        case .locationBatchTooLarge: return "LOCATION_BATCH_TOO_LARGE"
        case .limitExceeded: return "LIMIT_EXCEEDED"
        case .rateLimited: return "RATE_LIMITED"
        case .internalError: return "INTERNAL_ERROR"
        case .pushDeliveryFailed: return "PUSH_DELIVERY_FAILED"
        case .unknown(let raw): return raw
        }
    }
}

extension APIErrorCode: Codable {
    public init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = APIErrorCode(rawValue: raw)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}
