package com.whereswaldo.android.fakes

import com.whereswaldo.android.network.Features
import com.whereswaldo.android.network.PlanFlags
import com.whereswaldo.android.network.PlanLimits

/** Shared default [Features] fixture for A2 ViewModel tests (mirrors 001-api-contract.md §9's
 * example values) — avoids re-declaring the same plan-limits object in every fake/test. */
fun defaultFeatures(
    maxDevices: Int = 10,
    maxGeofences: Int = 20,
    historyDays: Int = 90,
    minSyncIntervalMinutes: Int = 5,
    locateRequestsPerDay: Int = 100,
): Features = Features(
    subscriptionStatus = "free",
    limits = PlanLimits(
        maxDevices = maxDevices,
        maxGeofences = maxGeofences,
        historyDays = historyDays,
        minSyncIntervalMinutes = minSyncIntervalMinutes,
        locateRequestsPerDay = locateRequestsPerDay,
    ),
    flags = PlanFlags(pushToLocate = true, geofencing = true, historyReplay = true),
)
