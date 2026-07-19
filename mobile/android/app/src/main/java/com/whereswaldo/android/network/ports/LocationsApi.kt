package com.whereswaldo.android.network.ports

import com.whereswaldo.android.network.ApiResult
import com.whereswaldo.android.network.dto.LatestLocationsResponseDto
import com.whereswaldo.android.network.dto.LocationFixDto
import com.whereswaldo.android.network.dto.LocationHistoryResponseDto
import com.whereswaldo.android.network.dto.ReportLocationsResponseDto

/** 001-api-contract.md §5 — Location reporting & reading. */
interface LocationsApi {
    suspend fun reportLocations(
        deviceId: String,
        batchId: String,
        fixes: List<LocationFixDto>,
    ): ApiResult<ReportLocationsResponseDto>

    suspend fun getLatestLocations(): ApiResult<LatestLocationsResponseDto>

    suspend fun getLocationHistory(
        userId: String,
        from: String,
        to: String,
        deviceId: String? = null,
        limit: Int? = null,
        cursor: String? = null,
    ): ApiResult<LocationHistoryResponseDto>
}
