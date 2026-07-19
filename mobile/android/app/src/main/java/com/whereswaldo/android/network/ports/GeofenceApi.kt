package com.whereswaldo.android.network.ports

import com.whereswaldo.android.network.ApiResult
import com.whereswaldo.android.network.ETagged
import com.whereswaldo.android.network.dto.GeofenceConfigResponseDto
import com.whereswaldo.android.network.dto.GeofenceDto
import com.whereswaldo.android.network.dto.GeofenceEventHistoryResponseDto
import com.whereswaldo.android.network.dto.GeofenceEventInputDto
import com.whereswaldo.android.network.dto.GeofenceEventsResponseDto

/** 001-api-contract.md §7 — Geofences. */
interface GeofenceApi {
    /** `Success(null, features = null)` means "304 Not Modified" (specs/003 §6.3). */
    suspend fun getGeofences(ifNoneMatch: String? = null): ApiResult<ETagged<GeofenceConfigResponseDto>?>

    suspend fun replaceGeofences(
        ifMatch: String,
        geofences: List<GeofenceDto>,
    ): ApiResult<ETagged<GeofenceConfigResponseDto>>

    suspend fun reportGeofenceEvents(
        deviceId: String,
        events: List<GeofenceEventInputDto>,
    ): ApiResult<GeofenceEventsResponseDto>

    suspend fun getGeofenceEventHistory(
        from: String,
        to: String,
        userId: String? = null,
        limit: Int? = null,
        cursor: String? = null,
    ): ApiResult<GeofenceEventHistoryResponseDto>
}
