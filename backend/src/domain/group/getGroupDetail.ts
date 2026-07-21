// specs/001 §12.3 — get group (group member). Pure domain logic: no Azure/Google imports.
// Every {groupId} route masks non-membership as GROUP_NOT_FOUND, indistinguishable from a
// nonexistent group (001 §12) — the membership check MUST run before the expiry check so a
// non-member always sees 404 regardless of the group's derived state.

import { AppError } from "../../http/errors";
import type { Clock } from "../../ports/support";
import type { EntitlementsRepo, GroupMember, GroupRepo, UsageRepo } from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";
import { deriveGroupState } from "./groupState";
import { toGroupListItem, type GroupListItem } from "./groupView";

export interface GetGroupDetailDeps {
  groupRepo: GroupRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface GetGroupDetailInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if family-less. */
  familyId: string | null;
  groupId: string;
}

export type GetGroupDetailResult = GroupListItem & {
  createdAt: string;
  /** null during grace (state "ended") for a non-owner member (005 §2.3) — hidden, not gone. */
  members: GroupMember[] | null;
  features: Features;
};

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function getGroupDetail(input: GetGroupDetailInput, deps: GetGroupDetailDeps): Promise<GetGroupDetailResult> {
  const meta = await deps.groupRepo.getGroupMeta(input.groupId);
  if (!meta) {
    throw new AppError("GROUP_NOT_FOUND", "group not found");
  }

  const membership = await deps.groupRepo.getMember(input.groupId, input.uid);
  if (!membership) {
    // Masked: a non-member sees the same error as a nonexistent group (001 §12).
    throw new AppError("GROUP_NOT_FOUND", "group not found");
  }

  let features: Features;
  if (input.familyId) {
    const entitlements = await deps.entitlementsRepo.get(input.familyId);
    if (!entitlements) {
      throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
    }
    features = getFeatures(entitlements.subscriptionStatus);
  } else {
    features = getFeatures("free");
  }

  const now = deps.clock.now();
  const state = deriveGroupState(now, meta.endsAt, meta.expiryPolicy, features.limits.groupGraceDays);
  if (state === "expired") {
    throw new AppError("GROUP_EXPIRED", "group has expired");
  }

  const allMembers = await deps.groupRepo.listMembers(input.groupId);
  const memberCount = allMembers.length;

  // Grace hides the roster from non-owner members (005 §2.3) — active and archived always
  // show it (archived is an intentional memento).
  const members = state === "ended" && membership.role !== "owner" ? null : allMembers;

  await deps.usageRepo.increment(input.familyId ?? input.uid, "apiCalls", usageDate(now));

  return {
    ...toGroupListItem(meta, membership.role, memberCount, state),
    createdAt: meta.createdAt,
    members,
    features,
  };
}
