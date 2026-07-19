import Foundation

/// The complete specs/001-api-contract.md client (§1.6 endpoint index — every one of the 19
/// endpoints, specs/004-ios-client.md §3.2). Mockable for tests; `URLSessionAPIClient` is the real
/// `URLSession`-backed implementation.
public protocol WaldoAPIClient {
    // §3 — Family management
    func createFamily(familyName: String, displayName: String) async throws -> Envelope<CreateFamilyResponse>
    func getMyFamily() async throws -> Envelope<GetMyFamilyResponse>
    func createInvite(role: String, emailHint: String?) async throws -> Envelope<CreateInviteResponse>
    func acceptInvite(inviteCode: String, displayName: String) async throws -> Envelope<AcceptInviteResponse>
    func updateMember(userId: String, role: String?, displayName: String?) async throws -> Envelope<FamilyMember>
    func removeMember(userId: String) async throws

    // §4 — Devices
    func registerDevice(_ request: RegisterDeviceRequest) async throws -> Envelope<DeviceResponse>
    func listDevices() async throws -> Envelope<ListDevicesResponse>
    func updateDevice(deviceId: String, _ request: UpdateDeviceRequest) async throws -> Envelope<DeviceResponse>

    // §5 — Location reporting & reading
    func reportLocations(deviceId: String, batchId: String, fixes: [LocationFix]) async throws -> Envelope<ReportLocationsResponse>
    func getLatestLocations() async throws -> Envelope<LatestLocationsResponse>
    func getLocationHistory(
        userId: String, deviceId: String?, from: String, to: String, limit: Int?, cursor: String?
    ) async throws -> Envelope<LocationHistoryResponse>

    // §6 — Push-to-locate
    func createLocateRequest(target: LocateTarget) async throws -> Envelope<CreateLocateRequestResponse>
    func pollLocateRequest(requestId: String) async throws -> Envelope<PollLocateRequestResponse>
    func fulfillLocateRequest(deviceId: String, requestId: String, fix: LocationFix) async throws -> Envelope<FulfillLocateRequestResponse>

    // §7 — Geofences
    func getGeofences(ifNoneMatch: String?) async throws -> GeofencesResult
    /// Returns the new config alongside the response `ETag` header (specs/001 §7.2 — "+ new ETag
    /// header"), which the caller caches for the next `getGeofences(ifNoneMatch:)`.
    func replaceGeofences(_ geofences: [Geofence], ifMatch: String) async throws -> (config: Envelope<GeofenceConfig>, etag: String)
    func reportGeofenceEvents(deviceId: String, events: [GeofenceEventReport]) async throws -> Envelope<ReportGeofenceEventsResponse>
    func getGeofenceEventHistory(
        from: String, to: String, userId: String?, limit: Int?, cursor: String?
    ) async throws -> Envelope<GeofenceEventHistoryResponse>
}
