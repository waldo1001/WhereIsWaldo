package com.whereswaldo.android.network.ports

import com.whereswaldo.android.network.ApiResult
import com.whereswaldo.android.network.dto.DeviceDto
import com.whereswaldo.android.network.dto.ListDevicesResponseDto
import com.whereswaldo.android.network.dto.RegisterDeviceRequestDto
import com.whereswaldo.android.network.dto.UpdateDeviceRequestDto

/** 001-api-contract.md §4 — Devices. */
interface DevicesApi {
    suspend fun registerDevice(request: RegisterDeviceRequestDto): ApiResult<DeviceDto>
    suspend fun listDevices(): ApiResult<ListDevicesResponseDto>
    suspend fun updateDevice(deviceId: String, request: UpdateDeviceRequestDto): ApiResult<DeviceDto>
}
