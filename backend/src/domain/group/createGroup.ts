// specs/001 §12.1 — create group. Pure domain logic: no Azure/Google imports. Bootstraps a
// profile if the caller has none (§1.5.3) — displayName is REQUIRED then, optional otherwise
// (defaults to the profile's, 005 §1). The caller always becomes owner.

import { AppError } from "../../http/errors";
import { createGroupRequestSchema, parseOrThrow } from "../../http/validate";
import type { Clock, IdGenerator, InviteCodeGenerator } from "../../ports/support";
import type {
  EntitlementsRepo,
  GroupCodeRepo,
  GroupExpiryRepo,
  GroupMeta,
  GroupRepo,
  UsageRepo,
  UserRepo,
} from "../../ports/repositories";
import { normalizeInviteCode } from "../family/inviteCode";
import { getFeatures, type Features } from "../plan";
import { deriveGroupState } from "./groupState";
import { toGroupListItem, type GroupListItem } from "./groupView";

export interface CreateGroupDeps {
  groupRepo: GroupRepo;
  groupCodeRepo: GroupCodeRepo;
  groupExpiryRepo: GroupExpiryRepo;
  userRepo: UserRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  idGenerator: IdGenerator;
  /** Same 8-char Crockford format/normalization as family invite codes (005 §1, 001 §1.4). */
  inviteCodeGenerator: InviteCodeGenerator;
  clock: Clock;
}

export interface CreateGroupInput {
  uid: string;
  body: unknown;
}

export type CreateGroupResult = GroupListItem & { createdAt: string; features: Features };

const GROUP_ID_LENGTH = 20;
const MIN_LEAD_TIME_MS = 60 * 60 * 1000; // 1h (001 §12.1)

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function bucketDateOf(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

export async function createGroup(input: CreateGroupInput, deps: CreateGroupDeps): Promise<CreateGroupResult> {
  const body = parseOrThrow(createGroupRequestSchema, input.body);

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

  const familyId = profile?.familyId ?? null;
  let features: Features;
  if (familyId) {
    const entitlements = await deps.entitlementsRepo.get(familyId);
    if (!entitlements) {
      throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
    }
    features = getFeatures(entitlements.subscriptionStatus);
  } else {
    features = getFeatures("free");
  }

  const now = deps.clock.now();
  const nowMs = now.getTime();
  const endsAtMs = new Date(body.endsAt).getTime();

  if (endsAtMs < nowMs + MIN_LEAD_TIME_MS) {
    throw new AppError("VALIDATION_FAILED", "endsAt must be at least 1h from now", { fields: ["endsAt"] });
  }
  const maxEndsAtMs = nowMs + features.limits.maxGroupDurationDays * 24 * 60 * 60 * 1000;
  if (endsAtMs > maxEndsAtMs) {
    throw new AppError("LIMIT_EXCEEDED", "endsAt exceeds the maximum group duration", {
      limit: "maxGroupDurationDays",
    });
  }

  // maxActiveGroups (005 §4): the caller's non-expired memberships, owned + joined.
  const memberships = await deps.userRepo.listGroupMemberships(input.uid);
  let activeCount = 0;
  for (const membership of memberships) {
    const existingMeta = await deps.groupRepo.getGroupMeta(membership.groupId);
    if (!existingMeta) continue; // orphaned reverse-index row (self-healing skip)
    const state = deriveGroupState(now, existingMeta.endsAt, existingMeta.expiryPolicy, features.limits.groupGraceDays);
    if (state !== "expired") activeCount += 1;
  }
  if (activeCount >= features.limits.maxActiveGroups) {
    throw new AppError("LIMIT_EXCEEDED", "maxActiveGroups cap reached", { limit: "maxActiveGroups" });
  }

  const groupId = `grp_${deps.idGenerator.next(GROUP_ID_LENGTH)}`;
  const code = normalizeInviteCode(deps.inviteCodeGenerator.next());
  const createdAt = now.toISOString();

  const meta: GroupMeta = {
    groupId,
    name: body.name,
    ownerUserId: input.uid,
    createdAt,
    endsAt: body.endsAt,
    expiryPolicy: body.expiryPolicy,
    code,
  };
  await deps.groupRepo.createGroupMeta(meta);
  await deps.groupRepo.addMember(groupId, { userId: input.uid, role: "owner", displayName, joinedAt: createdAt });
  await deps.groupCodeRepo.createCode(code, { groupId, createdAt });
  await deps.userRepo.addGroupMembership(input.uid, { groupId, role: "owner", joinedAt: createdAt });
  if (!profile) {
    await deps.userRepo.createProfile(input.uid, { familyId: null, role: null, displayName });
  }
  await deps.groupExpiryRepo.putExpiryRow(bucketDateOf(body.endsAt), groupId, "expire");
  await deps.usageRepo.increment(familyId ?? input.uid, "apiCalls", usageDate(now));

  return {
    ...toGroupListItem(meta, "owner", 1, "active"),
    createdAt,
    features,
  };
}
