// specs/001 §12.10 — group live map. Pure domain logic: no Azure/Google imports. Every
// {groupId} route masks non-membership as GROUP_NOT_FOUND, indistinguishable from a
// nonexistent group (001 §12) — the membership check MUST run before the expiry check
// (same ordering rule as getGroupDetail.ts) so a non-member always sees 404 regardless of
// the group's derived state. Only active groups serve a map — ended/archived/expired all
// answer 410 GROUP_EXPIRED (001 §12.10), unlike §12.3's ended-but-still-visible-to-owner case.

import { AppError } from "../../http/errors";
import type { Clock } from "../../ports/support";
import type { EntitlementsRepo, GroupLastKnownRepo, GroupRepo, GroupRole, UsageRepo } from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";
import { deriveGroupState } from "./groupState";

export interface GetGroupLatestLocationsDeps {
  groupRepo: GroupRepo;
  groupLastKnownRepo: GroupLastKnownRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface GetGroupLatestLocationsInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if family-less. */
  familyId: string | null;
  groupId: string;
}

// specs/001 §12.10 / specs/005 §3 — position-only: no deviceId, deviceName, batteryPct,
// source, altitude/speed/bearing.
export interface GroupMemberLocation {
  lat: number;
  lon: number;
  accuracyM: number;
  recordedAt: string;
  receivedAt: string;
  isStale: boolean;
}

export interface GroupLatestMember {
  userId: string;
  displayName: string;
  role: GroupRole;
  /** null = no position reported yet (001 §12.10). */
  location: GroupMemberLocation | null;
}

export interface GetGroupLatestLocationsResult {
  members: GroupLatestMember[];
  features: Features;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function getGroupLatestLocations(
  input: GetGroupLatestLocationsInput,
  deps: GetGroupLatestLocationsDeps,
): Promise<GetGroupLatestLocationsResult> {
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
  if (state !== "active") {
    throw new AppError("GROUP_EXPIRED", "group is not active");
  }

  const [allMembers, positions] = await Promise.all([
    deps.groupRepo.listMembers(input.groupId),
    deps.groupLastKnownRepo.listByGroup(input.groupId),
  ]);
  const positionByUser = new Map(positions.map((position) => [position.userId, position]));

  const members: GroupLatestMember[] = allMembers.map((member) => {
    const position = positionByUser.get(member.userId);
    if (!position) {
      return { userId: member.userId, displayName: member.displayName, role: member.role, location: null };
    }

    const ageMs = now.getTime() - new Date(position.recordedAt).getTime();
    const staleThresholdMs = 2 * position.syncIntervalMinutes * 60 * 1000;

    return {
      userId: member.userId,
      displayName: member.displayName,
      role: member.role,
      location: {
        lat: position.lat,
        lon: position.lon,
        accuracyM: position.accuracyM,
        recordedAt: position.recordedAt,
        receivedAt: position.receivedAt,
        isStale: ageMs > staleThresholdMs,
      },
    };
  });

  await deps.usageRepo.increment(input.familyId ?? input.uid, "apiCalls", usageDate(now));

  return { members, features };
}
