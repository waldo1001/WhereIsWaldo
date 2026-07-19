package com.whereswaldo.android.auth

import java.util.Base64
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DevAuthProviderTest {

    @Test
    fun `initially signed out with no token`() = runTest {
        val provider = DevAuthProvider(firebaseProjectId = "waldo-dev")

        assertEquals(AuthState.SignedOut, provider.authState.value)
        assertNull(provider.currentIdToken())
    }

    @Test
    fun `signInDev transitions to SignedIn and yields an unsigned JWT-shaped token`() = runTest {
        val provider = DevAuthProvider(firebaseProjectId = "waldo-dev", clock = { 1_000L })

        provider.signInDev("uid-123")

        assertEquals(AuthState.SignedIn("uid-123"), provider.authState.value)

        val token = provider.currentIdToken()
        requireNotNull(token)
        val parts = token.split(".")
        assertEquals(3, parts.size)
        assertTrue("signature segment must be empty (unsigned)", parts[2].isEmpty())

        val decoder = Base64.getUrlDecoder()
        val header = String(decoder.decode(parts[0]))
        val payload = String(decoder.decode(parts[1]))
        assertTrue(header.contains("\"alg\":\"none\""))
        assertTrue(payload.contains("\"sub\":\"uid-123\""))
        assertTrue(payload.contains("\"iss\":\"https://securetoken.google.com/waldo-dev\""))
        assertTrue(payload.contains("\"aud\":\"waldo-dev\""))
        assertTrue(payload.contains("\"iat\":1000"))
        assertTrue(payload.contains("\"exp\":4600"))
    }

    @Test
    fun `signOut clears the token`() = runTest {
        val provider = DevAuthProvider(firebaseProjectId = "waldo-dev")
        provider.signInDev("uid-123")

        provider.signOut()

        assertEquals(AuthState.SignedOut, provider.authState.value)
        assertNull(provider.currentIdToken())
    }

    @Test
    fun `no literal token constant appears — construction is entirely dynamic`() = runTest {
        // This test intentionally asserts behavior only (see the test bodies above); the
        // requirement it documents is structural (no literal JWT string anywhere in source),
        // enforced by code review / the security-review secret scan, not by an assertion here.
        val providerA = DevAuthProvider(firebaseProjectId = "waldo-dev", clock = { 1L })
        val providerB = DevAuthProvider(firebaseProjectId = "waldo-dev", clock = { 2L })
        providerA.signInDev("same-uid")
        providerB.signInDev("same-uid")

        assertTrue(providerA.currentIdToken() != providerB.currentIdToken())
    }
}
