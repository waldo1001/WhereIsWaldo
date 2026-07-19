package com.whereswaldo.android.network

import com.whereswaldo.android.network.dto.FeaturesDto
import com.whereswaldo.android.network.dto.PlanFlagsDto
import com.whereswaldo.android.network.dto.PlanLimitsDto
import org.junit.Assert.assertEquals
import org.junit.Test

class FeaturesMapperTest {

    @Test
    fun `toDomain copies every field faithfully`() {
        val dto = FeaturesDto(
            subscriptionStatus = "free",
            limits = PlanLimitsDto(
                maxDevices = 10,
                maxGeofences = 20,
                historyDays = 90,
                minSyncIntervalMinutes = 5,
                locateRequestsPerDay = 100,
            ),
            flags = PlanFlagsDto(pushToLocate = true, geofencing = true, historyReplay = true),
        )

        val domain = dto.toDomain()

        assertEquals("free", domain.subscriptionStatus)
        assertEquals(10, domain.limits.maxDevices)
        assertEquals(20, domain.limits.maxGeofences)
        assertEquals(90, domain.limits.historyDays)
        assertEquals(5, domain.limits.minSyncIntervalMinutes)
        assertEquals(100, domain.limits.locateRequestsPerDay)
        assertEquals(true, domain.flags.pushToLocate)
        assertEquals(true, domain.flags.geofencing)
        assertEquals(true, domain.flags.historyReplay)
    }
}
