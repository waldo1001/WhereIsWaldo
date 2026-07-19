package com.whereswaldo.android.fakes

import com.whereswaldo.android.device.DeviceInfoProvider

/** Test fake — the real implementation is `AndroidDeviceInfoProvider`
 * (specs/003-android-client.md §8). */
class FakeDeviceInfoProvider(
    override val platform: String = "android",
    override val model: String = "Pixel 8",
    override val appVersion: String = "1.0.0",
) : DeviceInfoProvider
