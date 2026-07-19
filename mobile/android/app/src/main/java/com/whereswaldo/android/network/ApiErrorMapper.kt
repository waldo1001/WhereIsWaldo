package com.whereswaldo.android.network

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive

/**
 * The single place a wire error `code` string is turned into a typed [ApiError]
 * (specs/003-android-client.md §6.1). Every one of the 21 codes in 001-api-contract.md §10 maps
 * to its own named subtype; anything else maps to [ApiError.Unknown] defensively.
 */
object ApiErrorMapper {

    fun fromCode(code: String, message: String, details: JsonObject?, requestId: String?): ApiError = when (code) {
        "AUTH_MISSING_TOKEN" -> ApiError.AuthMissingToken(message, requestId)
        "AUTH_INVALID_TOKEN" -> ApiError.AuthInvalidToken(message, requestId)
        "AUTH_TOKEN_EXPIRED" -> ApiError.AuthTokenExpired(message, requestId)
        "AUTH_FORBIDDEN" -> ApiError.AuthForbidden(message, requestId)
        "TRACKING_PAUSED" -> ApiError.TrackingPaused(deviceSettingsFrom(details), message, requestId)
        "FAMILY_NOT_FOUND" -> ApiError.FamilyNotFound(message, requestId)
        "MEMBER_NOT_FOUND" -> ApiError.MemberNotFound(message, requestId)
        "DEVICE_NOT_FOUND" -> ApiError.DeviceNotFound(message, requestId)
        "LOCATE_REQUEST_NOT_FOUND" -> ApiError.LocateRequestNotFound(message, requestId)
        "FAMILY_ALREADY_MEMBER" -> ApiError.FamilyAlreadyMember(message, requestId)
        "GEOFENCE_VERSION_CONFLICT" ->
            ApiError.GeofenceVersionConflict(stringField(details, "currentEtag"), message, requestId)
        "INVITE_EXPIRED" -> ApiError.InviteExpired(message, requestId)
        "LOCATE_REQUEST_EXPIRED" -> ApiError.LocateRequestExpired(message, requestId)
        "INVITE_INVALID" -> ApiError.InviteInvalid(message, requestId)
        "INVITE_ALREADY_USED" -> ApiError.InviteAlreadyUsed(message, requestId)
        "VALIDATION_FAILED" ->
            ApiError.ValidationFailed(fieldsList(details), stringField(details, "reason"), message, requestId)
        "LOCATION_BATCH_TOO_LARGE" -> ApiError.LocationBatchTooLarge(intField(details, "max"), message, requestId)
        "LIMIT_EXCEEDED" -> ApiError.LimitExceeded(stringField(details, "limit"), message, requestId)
        "RATE_LIMITED" -> ApiError.RateLimited(intField(details, "retryAfterSeconds"), message, requestId)
        "INTERNAL_ERROR" -> ApiError.InternalError(message, requestId)
        "PUSH_DELIVERY_FAILED" -> ApiError.PushDeliveryFailed(message, requestId)
        else -> ApiError.Unknown(code, message, requestId)
    }

    private fun stringField(details: JsonObject?, key: String): String? =
        details?.get(key)?.jsonPrimitive?.contentOrNull

    private fun intField(details: JsonObject?, key: String): Int? =
        details?.get(key)?.jsonPrimitive?.intOrNull

    private fun fieldsList(details: JsonObject?): List<String>? =
        details?.get("fields")?.jsonArray?.map { it.jsonPrimitive.content }

    private fun deviceSettingsFrom(details: JsonObject?): DeviceSettingsSnapshot? {
        val settings = details?.get("deviceSettings") as? JsonObject ?: return null
        val interval = settings["syncIntervalMinutes"]?.jsonPrimitive?.intOrNull ?: return null
        val enabled = settings["trackingEnabled"]?.jsonPrimitive?.contentOrNull?.toBooleanStrictOrNull() ?: return null
        return DeviceSettingsSnapshot(interval, enabled)
    }
}
