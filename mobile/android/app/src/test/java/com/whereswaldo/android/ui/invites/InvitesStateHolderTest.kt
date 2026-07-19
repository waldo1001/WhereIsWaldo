package com.whereswaldo.android.ui.invites

import com.whereswaldo.android.fakes.FakeFamilyApi
import com.whereswaldo.android.fakes.defaultFeatures
import com.whereswaldo.android.network.ApiError
import com.whereswaldo.android.network.ApiResult
import com.whereswaldo.android.network.dto.AcceptInviteResponseDto
import com.whereswaldo.android.network.dto.CreateInviteResponseDto
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** [InvitesStateHolder] is pure Kotlin — tested with [FakeFamilyApi]
 * (specs/003-android-client.md §14, §16). */
class InvitesStateHolderTest {

    @Test
    fun `createInvite success populates createdInvite and clears the loading flag`() = runTest {
        val api = FakeFamilyApi().apply {
            createInviteResult = ApiResult.Success(
                CreateInviteResponseDto("7F3K9QRZ", "member", "2026-07-22T10:00:00Z"),
                defaultFeatures(),
            )
        }
        val holder = InvitesStateHolder(api)

        holder.createInvite(role = "member", emailHint = "kid@example.com")

        val state = holder.state.value
        assertEquals("7F3K9QRZ", state.createdInvite?.inviteCode)
        assertEquals(false, state.isCreatingInvite)
        assertNull(state.createInviteError)
        assertEquals(listOf("member" to "kid@example.com"), api.createInviteCalls)
    }

    @Test
    fun `createInvite failure (non-parent) surfaces createInviteError`() = runTest {
        val api = FakeFamilyApi().apply {
            createInviteResult = ApiResult.Failure(ApiError.AuthForbidden("not a parent", "r_1"))
        }
        val holder = InvitesStateHolder(api)

        holder.createInvite(role = "member")

        val state = holder.state.value
        assertEquals("not a parent", state.createInviteError)
        assertNull(state.createdInvite)
        assertEquals(false, state.isCreatingInvite)
    }

    @Test
    fun `acceptInvite success populates acceptedFamily`() = runTest {
        val api = FakeFamilyApi().apply {
            acceptInviteResult = ApiResult.Success(
                AcceptInviteResponseDto("fam_test", "Wauters", "member"),
                defaultFeatures(),
            )
        }
        val holder = InvitesStateHolder(api)

        holder.acceptInvite(inviteCode = "7F3K9QRZ", displayName = "Noor")

        val state = holder.state.value
        assertEquals("Wauters", state.acceptedFamily?.familyName)
        assertEquals(false, state.isAcceptingInvite)
        assertNull(state.acceptInviteError)
        assertEquals(listOf("7F3K9QRZ" to "Noor"), api.acceptInviteCalls)
    }

    @Test
    fun `acceptInvite surfaces each catalog error distinctly`() = runTest {
        val api = FakeFamilyApi()
        val holder = InvitesStateHolder(api)

        api.acceptInviteResult = ApiResult.Failure(ApiError.InviteInvalid("unknown code", "r_1"))
        holder.acceptInvite("BADCODE1", "Noor")
        assertEquals("unknown code", holder.state.value.acceptInviteError)

        api.acceptInviteResult = ApiResult.Failure(ApiError.InviteAlreadyUsed("already used", "r_2"))
        holder.acceptInvite("USEDCODE", "Noor")
        assertEquals("already used", holder.state.value.acceptInviteError)

        api.acceptInviteResult = ApiResult.Failure(ApiError.InviteExpired("expired", "r_3"))
        holder.acceptInvite("OLDCODE1", "Noor")
        assertEquals("expired", holder.state.value.acceptInviteError)

        api.acceptInviteResult = ApiResult.Failure(ApiError.FamilyAlreadyMember("already in a family", "r_4"))
        holder.acceptInvite("ANYCODE1", "Noor")
        assertEquals("already in a family", holder.state.value.acceptInviteError)
    }

    @Test
    fun `create and accept flows are independent`() = runTest {
        val api = FakeFamilyApi().apply {
            createInviteResult = ApiResult.Failure(ApiError.AuthForbidden("nope", "r_1"))
            acceptInviteResult = ApiResult.Success(AcceptInviteResponseDto("fam_test", "Wauters", "member"), defaultFeatures())
        }
        val holder = InvitesStateHolder(api)

        holder.createInvite(role = "member")
        holder.acceptInvite("CODE1234", "Noor")

        val state = holder.state.value
        assertEquals("nope", state.createInviteError)
        assertEquals("Wauters", state.acceptedFamily?.familyName)
    }
}
