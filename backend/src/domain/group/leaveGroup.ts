// specs/001 §12.8 — leave a group (any member, not the owner). Bare 204 (no response body,
// no `features`). Pure domain logic: no Azure/Google imports. "Works in any non-expired
// state (clearing an archived memento is allowed)" — so `active`/`ended`/`archived` all
// succeed, only a truly `expired` (not yet swept) group is rejected (410).

import { AppError } from "../../http/errors";
import type { Clock } from "../../ports/support";
import type { EntitlementsRepo, GroupRepo, UsageRepo, UserRepo } from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";
import { deriveGroupState } from "./groupState";

export interface LeaveGroupDeps {
  groupRepo: GroupRepo;
  userRepo: UserRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface LeaveGroupInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if family-less. */
  familyId: string | null;
  groupId: string;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
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

export async function leaveGroup(input: LeaveGroupInput, deps: LeaveGroupDeps): Promise<void> {
  const meta = await deps.groupRepo.getGroupMeta(input.groupId);
  if (!meta) {
    throw new AppError("GROUP_NOT_FOUND", "group not found");
  }

  const membership = await deps.groupRepo.getMember(input.groupId, input.uid);
  if (!membership) {
    // Masked: a non-member sees the same error as a nonexistent group (001 §12).
    throw new AppError("GROUP_NOT_FOUND", "group not found");
  }
  if (membership.role === "owner") {
    // No ownership transfer in v1 (000 §O15) — the owner ends (§12.4) or deletes (§12.5).
    throw new AppError("VALIDATION_FAILED", "the owner cannot leave the group", {
      reason: "ownerCannotLeave",
    });
  }

  const features = await resolveFeatures(input.familyId, deps.entitlementsRepo);
  const now = deps.clock.now();
  const state = deriveGroupState(now, meta.endsAt, meta.expiryPolicy, features.limits.groupGraceDays);
  if (state === "expired") {
    throw new AppError("GROUP_EXPIRED", "group has expired");
  }

  await deps.groupRepo.removeMember(input.groupId, input.uid);
  await deps.userRepo.removeGroupMembership(input.uid, input.groupId);

  await deps.usageRepo.increment(input.familyId ?? input.uid, "apiCalls", usageDate(now));
}
