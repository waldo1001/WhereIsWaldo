package com.whereswaldo.android.network.ports

import com.whereswaldo.android.network.ApiResult
import com.whereswaldo.android.network.dto.AcceptInviteResponseDto
import com.whereswaldo.android.network.dto.CreateFamilyResponseDto
import com.whereswaldo.android.network.dto.CreateInviteResponseDto
import com.whereswaldo.android.network.dto.FamilyMeResponseDto
import com.whereswaldo.android.network.dto.MemberDto
import com.whereswaldo.android.network.dto.UpdateMemberRequestDto

/** 001-api-contract.md §3 — Family management. */
interface FamilyApi {
    suspend fun createFamily(familyName: String, displayName: String): ApiResult<CreateFamilyResponseDto>
    suspend fun getMyFamily(): ApiResult<FamilyMeResponseDto>
    suspend fun createInvite(role: String, emailHint: String? = null): ApiResult<CreateInviteResponseDto>
    suspend fun acceptInvite(inviteCode: String, displayName: String): ApiResult<AcceptInviteResponseDto>
    suspend fun updateMember(userId: String, request: UpdateMemberRequestDto): ApiResult<MemberDto>

    /** Bare 204 (§3.6) — see [ApiResult.Success.features] doc for why it's `null` here. */
    suspend fun removeMember(userId: String): ApiResult<Unit>
}
