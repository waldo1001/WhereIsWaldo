// specs/001 §3.6 — remove member (parent). Pure domain logic: no Azure/Google imports.
// Devices are keyed by ownerUserId, not familyId (002 §2.4, B8 re-key): the removed
// member's device registrations live entirely in their OWN partition, so cleanup is a
// single per-owner partition wipe — no familyId needed at all.

import { AppError } from "../../http/errors";
import type { Clock } from "../../ports/support";
import type { DeviceRepo, FamilyRepo, Role, UsageRepo, UserRepo } from "../../ports/repositories";

export interface RemoveMemberDeps {
  familyRepo: FamilyRepo;
  userRepo: UserRepo;
  deviceRepo: DeviceRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface RemoveMemberInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
  role: Role | null;
  targetUserId: string;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Bare 204 (specs/001 §3.6) — no response body, so no `features` to return. */
export async function removeMember(input: RemoveMemberInput, deps: RemoveMemberDeps): Promise<void> {
  if (!input.familyId) {
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  if (input.role !== "parent") {
    throw new AppError("AUTH_FORBIDDEN", "only a parent may remove members");
  }
  const familyId = input.familyId;

  const members = await deps.familyRepo.listMembers(familyId);
  const target = members.find((m) => m.userId === input.targetUserId);
  if (!target) {
    throw new AppError("MEMBER_NOT_FOUND", "member not found in caller's family");
  }

  if (target.role === "parent") {
    const parentCount = members.filter((m) => m.role === "parent").length;
    if (parentCount <= 1) {
      throw new AppError("VALIDATION_FAILED", "the last parent cannot remove themselves", {
        reason: "lastParent",
      });
    }
  }

  await deps.familyRepo.removeMember(familyId, input.targetUserId);
  await deps.userRepo.deleteProfile(input.targetUserId);
  await deps.deviceRepo.deleteDevicesByOwner(input.targetUserId);

  const now = deps.clock.now();
  await deps.usageRepo.increment(familyId, "apiCalls", usageDate(now));
}
