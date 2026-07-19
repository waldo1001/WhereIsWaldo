package com.whereswaldo.android.fakes

import com.whereswaldo.android.network.ApiResult
import com.whereswaldo.android.network.dto.DeviceSettingsDto
import com.whereswaldo.android.network.dto.LatestLocationsResponseDto
import com.whereswaldo.android.network.dto.LocationFixDto
import com.whereswaldo.android.network.dto.LocationHistoryResponseDto
import com.whereswaldo.android.network.dto.ReportLocationsResponseDto
import com.whereswaldo.android.network.ports.LocationsApi

/** Test fake — mirrors the backend's `test/fakes/` convention (backend/README.md). Scripts a
 * single canned [nextResult] per call for `LocationSyncCoordinatorTest`. */
class FakeLocationsApi : LocationsApi {
    val reportLocationsCalls = mutableListOf<Triple<String, String, List<LocationFixDto>>>()

    var nextResult: ApiResult<ReportLocationsResponseDto> = ApiResult.Success(
        ReportLocationsResponseDto(
            accepted = 0,
            duplicates = 0,
            lastKnownUpdated = false,
            deviceSettings = DeviceSettingsDto(15, true),
            geofenceEtag = "\"0\"",
        ),
        features = null,
    )

    override suspend fun reportLocations(
        deviceId: String,
        batchId: String,
        fixes: List<LocationFixDto>,
    ): ApiResult<ReportLocationsResponseDto> {
        reportLocationsCalls.add(Triple(deviceId, batchId, fixes))
        return nextResult
    }

    override suspend fun getLatestLocations(): ApiResult<LatestLocationsResponseDto> =
        throw UnsupportedOperationException("not exercised by A1 tests")

    override suspend fun getLocationHistory(
        userId: String,
        from: String,
        to: String,
        deviceId: String?,
        limit: Int?,
        cursor: String?,
    ): ApiResult<LocationHistoryResponseDto> =
        throw UnsupportedOperationException("not exercised by A1 tests")
}
