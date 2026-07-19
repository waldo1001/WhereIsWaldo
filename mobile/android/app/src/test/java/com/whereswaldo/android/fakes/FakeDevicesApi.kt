package com.whereswaldo.android.fakes

import com.whereswaldo.android.network.ApiResult
import com.whereswaldo.android.network.dto.DeviceDto
import com.whereswaldo.android.network.dto.ListDevicesResponseDto
import com.whereswaldo.android.network.dto.RegisterDeviceRequestDto
import com.whereswaldo.android.network.dto.UpdateDeviceRequestDto
import com.whereswaldo.android.network.ports.DevicesApi

/** Test fake — mirrors the backend's `test/fakes/` convention (backend/README.md). Records every
 * [registerDevice] call for assertion; `listDevices`/`updateDevice` are not exercised by A1's
 * tests and throw if accidentally called. */
class FakeDevicesApi : DevicesApi {
    val registerDeviceCalls = mutableListOf<RegisterDeviceRequestDto>()

    var resultToReturn: ApiResult<DeviceDto> = ApiResult.Success(
        DeviceDto(
            deviceId = "device-1",
            ownerUserId = "uid-test",
            platform = "android",
            deviceName = "Pixel 8",
            model = "Pixel 8",
            appVersion = "1.0.0",
            syncIntervalMinutes = 15,
            trackingEnabled = true,
            pushInvalid = false,
        ),
        features = null,
    )

    override suspend fun registerDevice(request: RegisterDeviceRequestDto): ApiResult<DeviceDto> {
        registerDeviceCalls.add(request)
        return resultToReturn
    }

    override suspend fun listDevices(): ApiResult<ListDevicesResponseDto> =
        throw UnsupportedOperationException("not exercised by A1 tests")

    override suspend fun updateDevice(deviceId: String, request: UpdateDeviceRequestDto): ApiResult<DeviceDto> =
        throw UnsupportedOperationException("not exercised by A1 tests")
}
