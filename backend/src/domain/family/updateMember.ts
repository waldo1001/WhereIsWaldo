// specs/001 §3.5 — update member (parent). Pure domain logic: no Azure/Google imports.

import { AppError } from "../../http/errors";
import { parseOrThrow, updateMemberRequestSchema } from "../../http/validate";
import type { Clock } from "../../ports/support";
import type { EntitlementsRepo, FamilyMember, FamilyRepo, Role, UsageRepo, UserRepo } from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";

export interface UpdateMemberDeps {
  familyRepo: FamilyRepo;
  userRepo: UserRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface UpdateMemberInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
  role: Role | null;
  targetUserId: string;
  body: unknown;
}

export interface UpdateMemberResult {
  member: FamilyMember;
  features: Features;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function updateMember(input: UpdateMemberInput, deps: UpdateMemberDeps): Promise<UpdateMemberResult> {
  if (!input.familyId) {
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  if (input.role !== "parent") {
    throw new AppError("AUTH_FORBIDDEN", "only a parent may update members");
  }
  const familyId = input.familyId;

  const patch = parseOrThrow(updateMemberRequestSchema, input.body);

  const entitlements = await deps.entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  const features = getFeatures(entitlements.subscriptionStatus);

  const members = await deps.familyRepo.listMembers(familyId);
  const target = members.find((m) => m.userId === input.targetUserId);
  if (!target) {
    throw new AppError("MEMBER_NOT_FOUND", "member not found in caller's family");
  }

  if (patch.role === "member" && target.role === "parent") {
    const parentCount = members.filter((m) => m.role === "parent").length;
    if (parentCount <= 1) {
      throw new AppError("VALIDATION_FAILED", "cannot demote the last parent", { reason: "lastParent" });
    }
  }

  const updated = await deps.familyRepo.updateMember(familyId, input.targetUserId, patch);
  await deps.userRepo.updateProfile(input.targetUserId, patch);

  const now = deps.clock.now();
  await deps.usageRepo.increment(familyId, "apiCalls", usageDate(now));

  return { member: updated, features };
}
