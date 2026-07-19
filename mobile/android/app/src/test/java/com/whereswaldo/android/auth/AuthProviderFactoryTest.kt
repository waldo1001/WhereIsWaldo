package com.whereswaldo.android.auth

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthProviderFactoryTest {

    @Test
    fun `InsecureLocal mode yields a DevAuthProvider`() {
        val provider = AuthProviderFactory.create(AuthMode.InsecureLocal, firebaseProjectId = "waldo-dev")

        assertTrue(provider is DevAuthProvider)
    }

    @Test
    fun `Firebase mode yields a stub that throws when actually used`() = runTest {
        val provider = AuthProviderFactory.create(AuthMode.Firebase, firebaseProjectId = "waldo-prod")

        assertTrue(provider is FirebaseAuthProviderStub)
        assertThrows(NotImplementedError::class.java) {
            kotlinx.coroutines.runBlocking { provider.currentIdToken() }
        }
    }

    @Test
    fun `AuthMode fromBuildConfigValue maps both legal values and rejects anything else`() {
        assertEquals(AuthMode.InsecureLocal, AuthMode.fromBuildConfigValue("insecure-local"))
        assertEquals(AuthMode.Firebase, AuthMode.fromBuildConfigValue("firebase"))
        assertThrows(IllegalStateException::class.java) {
            AuthMode.fromBuildConfigValue("something-else")
        }
    }
}
