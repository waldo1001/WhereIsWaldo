@testable import WaldoKit

/// A `WaldoAPIClient` test double. Only `registerDevice` is meaningfully recordable/configurable
/// today (Device tests, specs/004 §5); the rest fatalError if a test exercises them without first
/// wiring a recorder — a deliberate signal to extend this fake rather than silently no-op.
final class FakeAPIClient: WaldoAPIClient {
    private(set) var registerDeviceCalls: [RegisterDeviceRequest] = []
    var registerDeviceResult: Result<Envelope<DeviceResponse>, Error> = .success(
        TestFeatures.envelope(DeviceResponse(
            deviceId: "fake-device", ownerUserId: "fake-user", platform: "ios", deviceName: "fake",
            model: "fake", appVersion: "1.0.0", syncIntervalMinutes: 15, trackingEnabled: true, pushInvalid: false
        ))
    )

    func registerDevice(_ request: RegisterDeviceRequest) async throws -> Envelope<DeviceResponse> {
        registerDeviceCalls.append(request)
        return try registerDeviceResult.get()
    }

    // MARK: - Unused by current tests

    func createFamily(familyName: String, displayName: String) async throws -> Envelope<CreateFamilyResponse> { fatalError("not configured") }
    func getMyFamily() async throws -> Envelope<GetMyFamilyResponse> { fatalError("not configured") }
    func createInvite(role: String, emailHint: String?) async throws -> Envelope<CreateInviteResponse> { fatalError("not configured") }
    func acceptInvite(inviteCode: String, displayName: String) async throws -> Envelope<AcceptInviteResponse> { fatalError("not configured") }
    func updateMember(userId: String, role: String?, displayName: String?) async throws -> Envelope<FamilyMember> { fatalError("not configured") }
    func removeMember(userId: String) async throws { fatalError("not configured") }
    func listDevices() async throws -> Envelope<ListDevicesResponse> { fatalError("not configured") }
    func updateDevice(deviceId: String, _ request: UpdateDeviceRequest) async throws -> Envelope<DeviceResponse> { fatalError("not configured") }
    func reportLocations(deviceId: String, batchId: String, fixes: [LocationFix]) async throws -> Envelope<ReportLocationsResponse> { fatalError("not configured") }
    func getLatestLocations() async throws -> Envelope<LatestLocationsResponse> { fatalError("not configured") }
    func getLocationHistory(userId: String, deviceId: String?, from: String, to: String, limit: Int?, cursor: String?) async throws -> Envelope<LocationHistoryResponse> { fatalError("not configured") }
    func createLocateRequest(target: LocateTarget) async throws -> Envelope<CreateLocateRequestResponse> { fatalError("not configured") }
    func pollLocateRequest(requestId: String) async throws -> Envelope<PollLocateRequestResponse> { fatalError("not configured") }
    func fulfillLocateRequest(deviceId: String, requestId: String, fix: LocationFix) async throws -> Envelope<FulfillLocateRequestResponse> { fatalError("not configured") }
    func getGeofences(ifNoneMatch: String?) async throws -> GeofencesResult { fatalError("not configured") }
    func replaceGeofences(_ geofences: [Geofence], ifMatch: String) async throws -> (config: Envelope<GeofenceConfig>, etag: String) { fatalError("not configured") }
    func reportGeofenceEvents(deviceId: String, events: [GeofenceEventReport]) async throws -> Envelope<ReportGeofenceEventsResponse> { fatalError("not configured") }
    func getGeofenceEventHistory(from: String, to: String, userId: String?, limit: Int?, cursor: String?) async throws -> Envelope<GeofenceEventHistoryResponse> { fatalError("not configured") }
}
