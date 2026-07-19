package com.whereswaldo.android.network

import com.whereswaldo.android.fakes.FakeAuthProvider
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * 001-api-contract.md §2.1 / §6.4: a call receiving `AUTH_TOKEN_EXPIRED` forces a token refresh
 * and retries exactly once.
 */
class WaldoApiClientAuthRetryTest {

    private lateinit var server: MockWebServer
    private lateinit var authProvider: FakeAuthProvider
    private lateinit var client: WaldoApiClient

    private val successBody = """
        {"data":{"familyId":"fam_abc","familyName":"Wauters","createdAt":"2026-07-19T08:00:00Z",
                  "me":{"userId":"u1","role":"parent"},"members":[]},
         "features":{"subscriptionStatus":"free",
           "limits":{"maxDevices":10,"maxGeofences":20,"historyDays":90,
                     "minSyncIntervalMinutes":5,"locateRequestsPerDay":100},
           "flags":{"pushToLocate":true,"geofencing":true,"historyReplay":true}}}
    """.trimIndent()

    private val expiredBody = """{"error":{"code":"AUTH_TOKEN_EXPIRED","message":"expired","requestId":"r_1"}}"""

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        authProvider = FakeAuthProvider(initialToken = "stale-token")
        val service = RetrofitFactory.create(server.url("/").toString(), authProvider)
        client = WaldoApiClient(service, authProvider)
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `AUTH_TOKEN_EXPIRED triggers exactly one forced refresh and one retry, then succeeds`() = runTest {
        authProvider.tokenAfterRefresh = "fresh-token"
        server.enqueue(MockResponse().setResponseCode(401).setBody(expiredBody))
        server.enqueue(MockResponse().setResponseCode(200).setBody(successBody))

        val result = client.getMyFamily()

        assertTrue(result is ApiResult.Success)
        assertEquals(1, authProvider.forceRefreshCallCount)
        assertEquals(2, server.requestCount)

        val firstRequest = server.takeRequest()
        val secondRequest = server.takeRequest()
        assertEquals("Bearer stale-token", firstRequest.getHeader("Authorization"))
        assertEquals("Bearer fresh-token", secondRequest.getHeader("Authorization"))
    }

    @Test
    fun `a second AUTH_TOKEN_EXPIRED surfaces as Failure without a third attempt`() = runTest {
        server.enqueue(MockResponse().setResponseCode(401).setBody(expiredBody))
        server.enqueue(MockResponse().setResponseCode(401).setBody(expiredBody))

        val result = client.getMyFamily()

        assertTrue(result is ApiResult.Failure)
        assertTrue((result as ApiResult.Failure).error is ApiError.AuthTokenExpired)
        assertEquals(1, authProvider.forceRefreshCallCount)
        assertEquals(2, server.requestCount)
    }
}
