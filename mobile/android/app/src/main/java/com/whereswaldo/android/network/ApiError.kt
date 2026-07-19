package com.whereswaldo.android.network

/** A snapshot of `details.deviceSettings` on a `TRACKING_PAUSED` error (001-api-contract.md §10). */
data class DeviceSettingsSnapshot(val syncIntervalMinutes: Int, val trackingEnabled: Boolean)

/**
 * One subtype per 001-api-contract.md §10 catalog code, plus two client-local variants.
 * [ApiErrorMapper] is the single place that constructs these from a wire error code
 * (specs/003-android-client.md §6.1) — no other code should ever compare against a raw code
 * string.
 */
sealed class ApiError {
    abstract val message: String
    abstract val requestId: String?

    data class AuthMissingToken(override val message: String, override val requestId: String?) : ApiError()
    data class AuthInvalidToken(override val message: String, override val requestId: String?) : ApiError()
    data class AuthTokenExpired(override val message: String, override val requestId: String?) : ApiError()
    data class AuthForbidden(override val message: String, override val requestId: String?) : ApiError()

    data class TrackingPaused(
        val deviceSettings: DeviceSettingsSnapshot?,
        override val message: String,
        override val requestId: String?,
    ) : ApiError()

    data class FamilyNotFound(override val message: String, override val requestId: String?) : ApiError()
    data class MemberNotFound(override val message: String, override val requestId: String?) : ApiError()
    data class DeviceNotFound(override val message: String, override val requestId: String?) : ApiError()
    data class LocateRequestNotFound(override val message: String, override val requestId: String?) : ApiError()
    data class FamilyAlreadyMember(override val message: String, override val requestId: String?) : ApiError()

    data class GeofenceVersionConflict(
        val currentEtag: String?,
        override val message: String,
        override val requestId: String?,
    ) : ApiError()

    data class InviteExpired(override val message: String, override val requestId: String?) : ApiError()
    data class LocateRequestExpired(override val message: String, override val requestId: String?) : ApiError()
    data class InviteInvalid(override val message: String, override val requestId: String?) : ApiError()
    data class InviteAlreadyUsed(override val message: String, override val requestId: String?) : ApiError()

    data class ValidationFailed(
        val fields: List<String>?,
        val reason: String?,
        override val message: String,
        override val requestId: String?,
    ) : ApiError()

    data class LocationBatchTooLarge(
        val max: Int?,
        override val message: String,
        override val requestId: String?,
    ) : ApiError()

    data class LimitExceeded(
        val limit: String?,
        override val message: String,
        override val requestId: String?,
    ) : ApiError()

    data class RateLimited(
        val retryAfterSeconds: Int?,
        override val message: String,
        override val requestId: String?,
    ) : ApiError()

    data class InternalError(override val message: String, override val requestId: String?) : ApiError()
    data class PushDeliveryFailed(override val message: String, override val requestId: String?) : ApiError()

    /** A code the catalog doesn't (yet) define — defensive; should never trigger against a
     * spec-conformant backend (001 §10 is closed, "code may not be invented elsewhere"). */
    data class Unknown(val code: String, override val message: String, override val requestId: String?) : ApiError()

    /** No HTTP response at all (timeout, DNS, offline, …) — never constructed by
     * [ApiErrorMapper], only by `WaldoApiClient`'s `IOException` catch. */
    data class NetworkFailure(val cause: Throwable) : ApiError() {
        override val message: String get() = cause.message ?: "network failure"
        override val requestId: String? get() = null
    }
}
