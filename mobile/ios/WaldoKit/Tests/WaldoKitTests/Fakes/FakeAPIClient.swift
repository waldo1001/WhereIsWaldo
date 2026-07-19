@testable import WaldoKit

/// A `WaldoAPIClient` test double. `registerDevice` keeps its original I1 `Result`-based shape
/// (existing `DeviceRegistrationServiceTests` depend on it); every I2 method added below follows a
/// handler-closure shape instead, so a test can vary the response per call (needed for pagination,
/// ETag-conflict, and poll-until-terminal sequences) — anything not configured `fatalError`s, a
/// deliberate signal to extend this fake rather than silently no-op.
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

    // MARK: - §3 Family

    func createFamily(familyName: String, displayName: String) async throws -> Envelope<CreateFamilyResponse> { fatalError("not configured") }

    private(set) var getMyFamilyCallCount = 0
    var getMyFamilyHandler: () async throws -> Envelope<GetMyFamilyResponse> = { fatalError("not configured") }
    func getMyFamily() async throws -> Envelope<GetMyFamilyResponse> {
        getMyFamilyCallCount += 1
        return try await getMyFamilyHandler()
    }

    private(set) var createInviteCalls: [(role: String, emailHint: String?)] = []
    var createInviteHandler: (String, String?) async throws -> Envelope<CreateInviteResponse> = { _, _ in fatalError("not configured") }
    func createInvite(role: String, emailHint: String?) async throws -> Envelope<CreateInviteResponse> {
        createInviteCalls.append((role, emailHint))
        return try await createInviteHandler(role, emailHint)
    }

    private(set) var acceptInviteCalls: [(inviteCode: String, displayName: String)] = []
    var acceptInviteHandler: (String, String) async throws -> Envelope<AcceptInviteResponse> = { _, _ in fatalError("not configured") }
    func acceptInvite(inviteCode: String, displayName: String) async throws -> Envelope<AcceptInviteResponse> {
        acceptInviteCalls.append((inviteCode, displayName))
        return try await acceptInviteHandler(inviteCode, displayName)
    }

    private(set) var updateMemberCalls: [(userId: String, role: String?, displayName: String?)] = []
    var updateMemberHandler: (String, String?, String?) async throws -> Envelope<FamilyMember> = { _, _, _ in fatalError("not configured") }
    func updateMember(userId: String, role: String?, displayName: String?) async throws -> Envelope<FamilyMember> {
        updateMemberCalls.append((userId, role, displayName))
        return try await updateMemberHandler(userId, role, displayName)
    }

    private(set) var removeMemberCalls: [String] = []
    var removeMemberHandler: (String) async throws -> Void = { _ in fatalError("not configured") }
    func removeMember(userId: String) async throws {
        removeMemberCalls.append(userId)
        try await removeMemberHandler(userId)
    }

    // MARK: - §4 Devices

    private(set) var listDevicesCallCount = 0
    var listDevicesHandler: () async throws -> Envelope<ListDevicesResponse> = { fatalError("not configured") }
    func listDevices() async throws -> Envelope<ListDevicesResponse> {
        listDevicesCallCount += 1
        return try await listDevicesHandler()
    }

    private(set) var updateDeviceCalls: [(deviceId: String, request: UpdateDeviceRequest)] = []
    var updateDeviceHandler: (String, UpdateDeviceRequest) async throws -> Envelope<DeviceResponse> = { _, _ in fatalError("not configured") }
    func updateDevice(deviceId: String, _ request: UpdateDeviceRequest) async throws -> Envelope<DeviceResponse> {
        updateDeviceCalls.append((deviceId, request))
        return try await updateDeviceHandler(deviceId, request)
    }

    // MARK: - §5 Locations

    private(set) var getLatestLocationsCallCount = 0
    var getLatestLocationsHandler: () async throws -> Envelope<LatestLocationsResponse> = { fatalError("not configured") }
    func getLatestLocations() async throws -> Envelope<LatestLocationsResponse> {
        getLatestLocationsCallCount += 1
        return try await getLatestLocationsHandler()
    }

    func reportLocations(deviceId: String, batchId: String, fixes: [LocationFix]) async throws -> Envelope<ReportLocationsResponse> { fatalError("not configured") }

    private(set) var getLocationHistoryCalls: [(userId: String, deviceId: String?, from: String, to: String, limit: Int?, cursor: String?)] = []
    var getLocationHistoryHandler: (String, String?, String, String, Int?, String?) async throws -> Envelope<LocationHistoryResponse> = { _, _, _, _, _, _ in fatalError("not configured") }
    func getLocationHistory(userId: String, deviceId: String?, from: String, to: String, limit: Int?, cursor: String?) async throws -> Envelope<LocationHistoryResponse> {
        getLocationHistoryCalls.append((userId, deviceId, from, to, limit, cursor))
        return try await getLocationHistoryHandler(userId, deviceId, from, to, limit, cursor)
    }

    // MARK: - §6 Locate

    private(set) var createLocateRequestCalls: [LocateTarget] = []
    var createLocateRequestHandler: (LocateTarget) async throws -> Envelope<CreateLocateRequestResponse> = { _ in fatalError("not configured") }
    func createLocateRequest(target: LocateTarget) async throws -> Envelope<CreateLocateRequestResponse> {
        createLocateRequestCalls.append(target)
        return try await createLocateRequestHandler(target)
    }

    private(set) var pollLocateRequestCalls: [String] = []
    var pollLocateRequestHandler: (String) async throws -> Envelope<PollLocateRequestResponse> = { _ in fatalError("not configured") }
    func pollLocateRequest(requestId: String) async throws -> Envelope<PollLocateRequestResponse> {
        pollLocateRequestCalls.append(requestId)
        return try await pollLocateRequestHandler(requestId)
    }

    func fulfillLocateRequest(deviceId: String, requestId: String, fix: LocationFix) async throws -> Envelope<FulfillLocateRequestResponse> { fatalError("not configured") }

    // MARK: - §7 Geofences

    private(set) var getGeofencesCalls: [String?] = []
    var getGeofencesHandler: (String?) async throws -> GeofencesResult = { _ in fatalError("not configured") }
    func getGeofences(ifNoneMatch: String?) async throws -> GeofencesResult {
        getGeofencesCalls.append(ifNoneMatch)
        return try await getGeofencesHandler(ifNoneMatch)
    }

    private(set) var replaceGeofencesCalls: [(geofences: [Geofence], ifMatch: String)] = []
    var replaceGeofencesHandler: ([Geofence], String) async throws -> (config: Envelope<GeofenceConfig>, etag: String) = { _, _ in fatalError("not configured") }
    func replaceGeofences(_ geofences: [Geofence], ifMatch: String) async throws -> (config: Envelope<GeofenceConfig>, etag: String) {
        replaceGeofencesCalls.append((geofences, ifMatch))
        return try await replaceGeofencesHandler(geofences, ifMatch)
    }

    func reportGeofenceEvents(deviceId: String, events: [GeofenceEventReport]) async throws -> Envelope<ReportGeofenceEventsResponse> { fatalError("not configured") }
    func getGeofenceEventHistory(from: String, to: String, userId: String?, limit: Int?, cursor: String?) async throws -> Envelope<GeofenceEventHistoryResponse> { fatalError("not configured") }
}
