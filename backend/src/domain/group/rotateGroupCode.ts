// specs/001 §12.7 — rotate join code (owner). "The old code stops working instantly; there
// is always exactly one live code per active group." Pure domain logic: no Azure/Google
// imports. Order matches 002 §2.11: conditional-insert new row -> guarded-update
// Groups.meta.code -> delete old row — a crash between steps still resolves (old or new,
// never neither); joinGroup.ts additionally cross-checks the presented code against the
// authoritative `Groups.meta.code` (001 §12.7 security fix, 002 §2.11), which is what
// actually makes "the old code stops working instantly" true even mid-rotation, independent
// of whether this createCode/updateGroupMeta/deleteCode sequence has finished.
//
// State gating: 005 §2.3's lazy-enforcement matrix now documents this explicitly — gated
// like leave/kick (001 §12.8/§12.9): allowed on active/ended (grace)/archived, rejected only
// once truly `expired` (410, about to be swept) — rather than like PATCH (001 §12.4, which
// also blocks `archived`): rotating a code doesn't conflict with any archived-specific
// invariant the way extending endsAt would.
import { AppError } from "../../http/errors";
import type { Clock, InviteCodeGenerator } from "../../ports/support";
import type { EntitlementsRepo, GroupCodeRepo, GroupRepo, UsageRepo } from "../../ports/repositories";
import { normalizeInviteCode } from "../family/inviteCode";
import { getFeatures, type Features } from "../plan";
import { deriveGroupState } from "./groupState";

export interface RotateGroupCodeDeps {
  groupRepo: GroupRepo;
  groupCodeRepo: GroupCodeRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  /** Same 8-char Crockford format/normalization as family invite codes (005 §1, 001 §1.4). */
  inviteCodeGenerator: InviteCodeGenerator;
  clock: Clock;
}

export interface RotateGroupCodeInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if family-less. */
  familyId: string | null;
  groupId: string;
}

export interface RotateGroupCodeResult {
  code: string;
  rotatedAt: string;
  features: Features;
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

export async function rotateGroupCode(
  input: RotateGroupCodeInput,
  deps: RotateGroupCodeDeps,
): Promise<RotateGroupCodeResult> {
  const meta = await deps.groupRepo.getGroupMeta(input.groupId);
  if (!meta) {
    throw new AppError("GROUP_NOT_FOUND", "group not found");
  }

  const membership = await deps.groupRepo.getMember(input.groupId, input.uid);
  if (!membership) {
    // Masked: a non-member sees the same error as a nonexistent group (001 §12).
    throw new AppError("GROUP_NOT_FOUND", "group not found");
  }
  if (membership.role !== "owner") {
    throw new AppError("AUTH_FORBIDDEN", "only the group owner may rotate the join code");
  }

  const features = await resolveFeatures(input.familyId, deps.entitlementsRepo);
  const now = deps.clock.now();
  const state = deriveGroupState(now, meta.endsAt, meta.expiryPolicy, features.limits.groupGraceDays);
  if (state === "expired") {
    throw new AppError("GROUP_EXPIRED", "group has expired");
  }

  const newCode = normalizeInviteCode(deps.inviteCodeGenerator.next());
  const rotatedAt = now.toISOString();

  await deps.groupCodeRepo.createCode(newCode, { groupId: input.groupId, createdAt: rotatedAt });
  await deps.groupRepo.updateGroupMeta(input.groupId, { code: newCode });
  await deps.groupCodeRepo.deleteCode(meta.code);

  await deps.usageRepo.increment(input.familyId ?? input.uid, "apiCalls", usageDate(now));

  return { code: newCode, rotatedAt, features };
}
