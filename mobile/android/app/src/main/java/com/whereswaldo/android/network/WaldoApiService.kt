package com.whereswaldo.android.network

import com.whereswaldo.android.network.dto.AcceptInviteRequestDto
import com.whereswaldo.android.network.dto.AcceptInviteResponseDto
import com.whereswaldo.android.network.dto.CreateFamilyRequestDto
import com.whereswaldo.android.network.dto.CreateFamilyResponseDto
import com.whereswaldo.android.network.dto.CreateInviteRequestDto
import com.whereswaldo.android.network.dto.CreateInviteResponseDto
import com.whereswaldo.android.network.dto.CreateLocateRequestRequestDto
import com.whereswaldo.android.network.dto.DeviceDto
import com.whereswaldo.android.network.dto.FamilyMeResponseDto
import com.whereswaldo.android.network.dto.FulfillLocateRequestRequestDto
import com.whereswaldo.android.network.dto.FulfillResponseDto
import com.whereswaldo.android.network.dto.GeofenceConfigResponseDto
import com.whereswaldo.android.network.dto.GeofenceEventHistoryResponseDto
import com.whereswaldo.android.network.dto.GeofenceEventsResponseDto
import com.whereswaldo.android.network.dto.ListDevicesResponseDto
import com.whereswaldo.android.network.dto.LocateRequestDto
import com.whereswaldo.android.network.dto.LocateRequestStatusResponseDto
import com.whereswaldo.android.network.dto.LocationHistoryResponseDto
import com.whereswaldo.android.network.dto.MemberDto
import com.whereswaldo.android.network.dto.RegisterDeviceRequestDto
import com.whereswaldo.android.network.dto.ReplaceGeofencesRequestDto
import com.whereswaldo.android.network.dto.ReportGeofenceEventsRequestDto
import com.whereswaldo.android.network.dto.ReportLocationsRequestDto
import com.whereswaldo.android.network.dto.ReportLocationsResponseDto
import com.whereswaldo.android.network.dto.UpdateDeviceRequestDto
import com.whereswaldo.android.network.dto.UpdateMemberRequestDto
import com.whereswaldo.android.network.dto.LatestLocationsResponseDto
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Raw Retrofit surface — one method per 001-api-contract.md §3–§7 endpoint, per the mapping
 * table in specs/003-android-client.md §5. Base URL ends in `/api/`; every path here is
 * `v1/...`, together forming 001 §1.1's `/api/v1/...` routes.
 *
 * Nothing outside [WaldoApiClient] depends on this interface directly — it implements the five
 * narrow port interfaces (`network/ports/`) that the rest of the app actually uses.
 */
interface WaldoApiService {

    // ---- §3 Family management ----

    @POST("v1/families")
    suspend fun createFamily(@Body request: CreateFamilyRequestDto): Response<Envelope<CreateFamilyResponseDto>>

    @GET("v1/families/me")
    suspend fun getMyFamily(): Response<Envelope<FamilyMeResponseDto>>

    @POST("v1/families/me/invites")
    suspend fun createInvite(@Body request: CreateInviteRequestDto): Response<Envelope<CreateInviteResponseDto>>

    @POST("v1/invites/accept")
    suspend fun acceptInvite(@Body request: AcceptInviteRequestDto): Response<Envelope<AcceptInviteResponseDto>>

    @PATCH("v1/families/me/members/{userId}")
    suspend fun updateMember(
        @Path("userId") userId: String,
        @Body request: UpdateMemberRequestDto,
    ): Response<Envelope<MemberDto>>

    /** Bare 204 (001 §3.6) — `ResponseBody` is Retrofit's built-in identity converter, so no JSON
     * parser is ever invoked on the intentionally empty body (specs/003 §6.3). */
    @DELETE("v1/families/me/members/{userId}")
    suspend fun removeMember(@Path("userId") userId: String): Response<ResponseBody>

    // ---- §4 Devices ----

    @POST("v1/devices")
    suspend fun registerDevice(@Body request: RegisterDeviceRequestDto): Response<Envelope<DeviceDto>>

    @GET("v1/devices")
    suspend fun listDevices(): Response<Envelope<ListDevicesResponseDto>>

    @PATCH("v1/devices/{deviceId}")
    suspend fun updateDevice(
        @Path("deviceId") deviceId: String,
        @Body request: UpdateDeviceRequestDto,
    ): Response<Envelope<DeviceDto>>

    // ---- §5 Location reporting & reading ----

    @POST("v1/locations")
    suspend fun reportLocations(
        @Header("X-Device-Id") deviceId: String,
        @Body request: ReportLocationsRequestDto,
    ): Response<Envelope<ReportLocationsResponseDto>>

    @GET("v1/locations/latest")
    suspend fun getLatestLocations(): Response<Envelope<LatestLocationsResponseDto>>

    @GET("v1/locations/history")
    suspend fun getLocationHistory(
        @Query("userId") userId: String,
        @Query("from") from: String,
        @Query("to") to: String,
        @Query("deviceId") deviceId: String? = null,
        @Query("limit") limit: Int? = null,
        @Query("cursor") cursor: String? = null,
    ): Response<Envelope<LocationHistoryResponseDto>>

    // ---- §6 Push-to-locate ----

    @POST("v1/locate-requests")
    suspend fun createLocateRequest(
        @Body request: CreateLocateRequestRequestDto,
    ): Response<Envelope<LocateRequestDto>>

    @GET("v1/locate-requests/{requestId}")
    suspend fun getLocateRequest(
        @Path("requestId") requestId: String,
    ): Response<Envelope<LocateRequestStatusResponseDto>>

    @POST("v1/locate-requests/{requestId}/fulfill")
    suspend fun fulfillLocateRequest(
        @Path("requestId") requestId: String,
        @Header("X-Device-Id") deviceId: String,
        @Body request: FulfillLocateRequestRequestDto,
    ): Response<Envelope<FulfillResponseDto>>

    // ---- §7 Geofences ----

    /** A `304` is not `isSuccessful` (only 200–299 counts) — handled as a first-class branch in
     * [WaldoApiClient] before generic error handling (specs/003 §6.3). */
    @GET("v1/geofences")
    suspend fun getGeofences(
        @Header("If-None-Match") ifNoneMatch: String? = null,
    ): Response<Envelope<GeofenceConfigResponseDto>>

    @PUT("v1/geofences")
    suspend fun replaceGeofences(
        @Header("If-Match") ifMatch: String,
        @Body request: ReplaceGeofencesRequestDto,
    ): Response<Envelope<GeofenceConfigResponseDto>>

    @POST("v1/geofence-events")
    suspend fun reportGeofenceEvents(
        @Header("X-Device-Id") deviceId: String,
        @Body request: ReportGeofenceEventsRequestDto,
    ): Response<Envelope<GeofenceEventsResponseDto>>

    @GET("v1/geofence-events")
    suspend fun getGeofenceEventHistory(
        @Query("from") from: String,
        @Query("to") to: String,
        @Query("userId") userId: String? = null,
        @Query("limit") limit: Int? = null,
        @Query("cursor") cursor: String? = null,
    ): Response<Envelope<GeofenceEventHistoryResponseDto>>
}
