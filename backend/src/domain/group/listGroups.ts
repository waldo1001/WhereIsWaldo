// specs/001 §12.2 — list my groups. Pure domain logic: no Azure/Google imports. Expired
// groups are filtered out; ended (grace)/archived ones appear with their derived state.

import { AppError } from "../../http/errors";
import type { Clock } from "../../ports/support";
import type { EntitlementsRepo, GroupRepo, UsageRepo, UserRepo } from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";
import { deriveGroupState } from "./groupState";
import { toGroupListItem, type GroupListItem } from "./groupView";

export interface ListGroupsDeps {
  groupRepo: GroupRepo;
  userRepo: UserRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface ListGroupsInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if family-less. */
  familyId: string | null;
}

export interface ListGroupsResult {
  groups: GroupListItem[];
  features: Features;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function listGroups(input: ListGroupsInput, deps: ListGroupsDeps): Promise<ListGroupsResult> {
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
  const memberships = await deps.userRepo.listGroupMemberships(input.uid);

  const groups: GroupListItem[] = [];
  for (const membership of memberships) {
    const meta = await deps.groupRepo.getGroupMeta(membership.groupId);
    if (!meta) continue; // orphaned reverse-index row (self-healing skip)

    const state = deriveGroupState(now, meta.endsAt, meta.expiryPolicy, features.limits.groupGraceDays);
    if (state === "expired") continue; // never serialized (005 §2.2, 001 §12)

    const memberCount = (await deps.groupRepo.listMembers(meta.groupId)).length;
    groups.push(toGroupListItem(meta, membership.role, memberCount, state));
  }

  await deps.usageRepo.increment(input.familyId ?? input.uid, "apiCalls", usageDate(now));

  return { groups, features };
}
