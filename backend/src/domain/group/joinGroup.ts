// specs/001 §12.6 — join group. Pure domain logic: no Azure/Google imports. Bootstraps a
// profile if the caller has none (§1.5.3) — displayName is REQUIRED then, optional otherwise
// (defaults to the profile's, 005 §1). `maxGroupMembers` is resolved from the group OWNER's
// plan (001 §9) — the "owner upgrades -> bigger group" story without snapshotting limits.

import { AppError } from "../../http/errors";
import { joinGroupRequestSchema, parseOrThrow } from "../../http/validate";
import type { Clock } from "../../ports/support";
import type { EntitlementsRepo, GroupCodeRepo, GroupRepo, UsageRepo, UserRepo } from "../../ports/repositories";
import { normalizeInviteCode } from "../family/inviteCode";
import { getFeatures, type Features } from "../plan";
import { deriveGroupState } from "./groupState";
import { toGroupListItem, type GroupListItem } from "./groupView";

export interface JoinGroupDeps {
  groupRepo: GroupRepo;
  groupCodeRepo: GroupCodeRepo;
  userRepo: UserRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface JoinGroupInput {
  uid: string;
  body: unknown;
}

export type JoinGroupResult = GroupListItem & { features: Features };

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function resolveFeatures(
  familyId: string | null,
  entitlementsRepo: EntitlementsRepo,
): Promise<Features> {
  if (!familyId) {
    return getFeatures("free");
  }
  const entitlements = await entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  return getFeatures(entitlements.subscriptionStatus);
}

export async function joinGroup(input: JoinGroupInput, deps: JoinGroupDeps): Promise<JoinGroupResult> {
  const body = parseOrThrow(joinGroupRequestSchema, input.body);

  const profile = await deps.userRepo.getProfile(input.uid);

  let displayName: string;
  if (profile) {
    displayName = body.displayName ?? profile.displayName;
  } else {
    if (!body.displayName) {
      throw new AppError("VALIDATION_FAILED", "displayName is required when bootstrapping a profile", {
        fields: ["displayName"],
      });
    }
    displayName = body.displayName;
  }

  const normalizedCode = normalizeInviteCode(body.code);
  const codeRecord = await deps.groupCodeRepo.getCode(normalizedCode);
  if (!codeRecord) {
    throw new AppError("GROUP_CODE_INVALID", "unknown or rotated group join code");
  }

  const meta = await deps.groupRepo.getGroupMeta(codeRecord.groupId);
  if (!meta) {
    // Orphaned code row (race with the sweeper) — masked the same as an unknown code.
    throw new AppError("GROUP_CODE_INVALID", "unknown or rotated group join code");
  }

  const callerFamilyId = profile?.familyId ?? null;
  const callerFeatures = await resolveFeatures(callerFamilyId, deps.entitlementsRepo);

  const now = deps.clock.now();
  const state = deriveGroupState(now, meta.endsAt, meta.expiryPolicy, callerFeatures.limits.groupGraceDays);

  // 005 §2.3 join row: expired groups mask as an invalid code (about to be swept), while
  // ended (grace)/archived groups are still resolvable but past joinability -> GROUP_EXPIRED.
  if (state === "expired") {
    throw new AppError("GROUP_CODE_INVALID", "unknown or rotated group join code");
  }
  if (state !== "active") {
    throw new AppError("GROUP_EXPIRED", "group is no longer joinable");
  }

  const existingMembership = await deps.groupRepo.getMember(meta.groupId, input.uid);
  if (existingMembership) {
    throw new AppError("GROUP_ALREADY_MEMBER", "caller is already a member of this group");
  }

  const ownerProfile = await deps.userRepo.getProfile(meta.ownerUserId);
  if (!ownerProfile) {
    throw new AppError("INTERNAL_ERROR", "group owner has no profile");
  }
  const ownerFeatures = await resolveFeatures(ownerProfile.familyId, deps.entitlementsRepo);

  const currentMembers = await deps.groupRepo.listMembers(meta.groupId);
  if (currentMembers.length >= ownerFeatures.limits.maxGroupMembers) {
    throw new AppError("GROUP_FULL", "group is at capacity", { max: ownerFeatures.limits.maxGroupMembers });
  }

  const joinedAt = now.toISOString();
  await deps.groupRepo.addMember(meta.groupId, { userId: input.uid, role: "member", displayName, joinedAt });
  await deps.userRepo.addGroupMembership(input.uid, { groupId: meta.groupId, role: "member", joinedAt });
  if (!profile) {
    await deps.userRepo.createProfile(input.uid, { familyId: null, role: null, displayName });
  }
  await deps.usageRepo.increment(callerFamilyId ?? input.uid, "apiCalls", usageDate(now));

  return {
    ...toGroupListItem(meta, "member", currentMembers.length + 1, "active"),
    features: callerFeatures,
  };
}
