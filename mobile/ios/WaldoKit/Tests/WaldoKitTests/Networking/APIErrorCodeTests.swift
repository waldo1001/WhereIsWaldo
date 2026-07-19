import Testing
import Foundation
@testable import WaldoKit

/// specs/004-ios-client.md §3.1, §10 — every catalog code MUST decode to its case; anything
/// unrecognized falls back to `.unknown` (forward-compat, defensive only).
struct APIErrorCodeTests {

    /// The complete 001 §10 catalog (21 codes) mapped to the expected case.
    let catalog: [(raw: String, expected: APIErrorCode)] = [
        ("AUTH_MISSING_TOKEN", .authMissingToken),
        ("AUTH_INVALID_TOKEN", .authInvalidToken),
        ("AUTH_TOKEN_EXPIRED", .authTokenExpired),
        ("AUTH_FORBIDDEN", .authForbidden),
        ("TRACKING_PAUSED", .trackingPaused),
        ("FAMILY_NOT_FOUND", .familyNotFound),
        ("MEMBER_NOT_FOUND", .memberNotFound),
        ("DEVICE_NOT_FOUND", .deviceNotFound),
        ("LOCATE_REQUEST_NOT_FOUND", .locateRequestNotFound),
        ("FAMILY_ALREADY_MEMBER", .familyAlreadyMember),
        ("GEOFENCE_VERSION_CONFLICT", .geofenceVersionConflict),
        ("INVITE_EXPIRED", .inviteExpired),
        ("LOCATE_REQUEST_EXPIRED", .locateRequestExpired),
        ("INVITE_INVALID", .inviteInvalid),
        ("INVITE_ALREADY_USED", .inviteAlreadyUsed),
        ("VALIDATION_FAILED", .validationFailed),
        ("LOCATION_BATCH_TOO_LARGE", .locationBatchTooLarge),
        ("LIMIT_EXCEEDED", .limitExceeded),
        ("RATE_LIMITED", .rateLimited),
        ("INTERNAL_ERROR", .internalError),
        ("PUSH_DELIVERY_FAILED", .pushDeliveryFailed),
    ]

    @Test func catalogHasExactlyTwentyOneCodes() {
        #expect(catalog.count == 21, "001 §10 defines exactly 21 codes")
    }

    @Test func allCatalogCodes_roundTripThroughRawValue() {
        for pair in catalog {
            #expect(APIErrorCode(rawValue: pair.raw) == pair.expected, "\(pair.raw) should decode to \(pair.expected)")
            #expect(pair.expected.rawValue == pair.raw, "\(pair.expected) should re-encode to \(pair.raw)")
        }
    }

    @Test func allCatalogCodes_decodeViaJSON() throws {
        for pair in catalog {
            let json = "\"\(pair.raw)\"".data(using: .utf8)!
            let decoded = try JSONDecoder().decode(APIErrorCode.self, from: json)
            #expect(decoded == pair.expected)
        }
    }

    @Test func unrecognizedCode_decodesToUnknown() throws {
        let json = "\"SOME_FUTURE_CODE\"".data(using: .utf8)!
        let decoded = try JSONDecoder().decode(APIErrorCode.self, from: json)
        #expect(decoded == .unknown("SOME_FUTURE_CODE"))
    }

    @Test func unknownCode_encodesBackToItsRawString() throws {
        let code = APIErrorCode.unknown("SOME_FUTURE_CODE")
        let data = try JSONEncoder().encode(code)
        #expect(String(data: data, encoding: .utf8) == "\"SOME_FUTURE_CODE\"")
    }
}
