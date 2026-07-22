// specs/001 §12.9 — kick a member (owner). Bare 204 (no response body, no `features`).
// "Same removals as §12.8" (leave) applied to `{userId}`: same non-expired state gate, same
// removal set — "their position disappears from the group map immediately" (001 §12.9, 005
// §7 test checklist: "kick removes the member's location row immediately"). The owner cannot
// kick themselves — reuses leave's `ownerCannotLeave` reason (001 §12.9 is explicit about
// this, even though the action is "kick" not "leave").

import { AppError } from "../../http/errors";
import type { Clock } from "../../ports/support";
import type { EntitlementsRepo, GroupLastKnownRepo, GroupRepo, UserRepo } from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";
import { deriveGroupState } from "./groupState";

export interface KickMemberDeps {
  groupRepo: GroupRepo;
  groupLastKnownRepo: GroupLastKnownRepo;
  userRepo: UserRepo;
  entitlementsRepo: EntitlementsRepo;
  clock: Clock;
}

export interface KickMemberInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if family-less. */
  familyId: string | null;
  groupId: string;
  targetUserId: string;
}

async function resolveFeatures(familyId: string | null, entitlementsRepo: EntitlementsRepo): Promise<Features> {
  if (!familyId) {
    return getFeatures("free");
  }
  const entitlements = await entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  return getFeatures(entitlements.subscriptionStatus);
}

export async function kickMember(input: KickMemberInput, deps: KickMemberDeps): Promise<void> {
  const meta = await deps.groupRepo.getGroupMeta(input.groupId);
  if (!meta) {
    throw new AppError("GROUP_NOT_FOUND", "group not found");
  }

  const callerMembership = await deps.groupRepo.getMember(input.groupId, input.uid);
  if (!callerMembership) {
    // Masked: a non-member sees the same error as a nonexistent group (001 §12).
    throw new AppError("GROUP_NOT_FOUND", "group not found");
  }
  if (callerMembership.role !== "owner") {
    throw new AppError("AUTH_FORBIDDEN", "only the group owner may kick members");
  }

  if (input.targetUserId === input.uid) {
    // No ownership transfer in v1 (000 §O15) — the owner ends (§12.4) or deletes (§12.5).
    throw new AppError("VALIDATION_FAILED", "the owner cannot kick themselves", {
      reason: "ownerCannotLeave",
    });
  }

  const features = await resolveFeatures(input.familyId, deps.entitlementsRepo);
  const now = deps.clock.now();
  const state = deriveGroupState(now, meta.endsAt, meta.expiryPolicy, features.limits.groupGraceDays);
  if (state === "expired") {
    throw new AppError("GROUP_EXPIRED", "group has expired");
  }

  const targetMembership = await deps.groupRepo.getMember(input.groupId, input.targetUserId);
  if (!targetMembership) {
    throw new AppError("MEMBER_NOT_FOUND", "member not found in this group");
  }

  await deps.groupRepo.removeMember(input.groupId, input.targetUserId);
  await deps.userRepo.removeGroupMembership(input.targetUserId, input.groupId);
  await deps.groupLastKnownRepo.removeMember(input.groupId, input.targetUserId);
}
