// specs/001 §12.5 — delete group (owner). Bare 204 (no response body, no `features`).
// Immediate, synchronous hard delete of everything (members, code, indexes — 005 §2.4),
// "in any state, regardless of policy" (001 §12.5, 005 §2.4, 002 §4.1 step 3) — deliberately
// NOT gated by derived state (unlike leave/kick, which reject `expired`, 001 §12.8/§12.9):
// this is the same terminal action the sweeper would perform anyway, just synchronous.
// Pure domain logic: no Azure/Google imports. GroupLastKnown (002 §2.12, group live
// positions) doesn't exist yet as a port — B11 introduces it; when it lands, its per-group
// partition wipe belongs here too (it's a self-contained partition, so no `for-member` fan
// out is needed, unlike the reverse-index rows below).

import { AppError } from "../../http/errors";
import type { Clock } from "../../ports/support";
import type { GroupCodeRepo, GroupExpiryRepo, GroupRepo, UsageRepo, UserRepo } from "../../ports/repositories";

export interface DeleteGroupDeps {
  groupRepo: GroupRepo;
  groupCodeRepo: GroupCodeRepo;
  groupExpiryRepo: GroupExpiryRepo;
  userRepo: UserRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface DeleteGroupInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if family-less. */
  familyId: string | null;
  groupId: string;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function bucketDateOf(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

export async function deleteGroup(input: DeleteGroupInput, deps: DeleteGroupDeps): Promise<void> {
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
    throw new AppError("AUTH_FORBIDDEN", "only the group owner may delete the group");
  }

  // Same order as the sweeper's own hard-delete step (002 §4.1 step 3): read the roster
  // first (needed for the reverse-index cleanup), then tear down code -> members -> meta ->
  // expiry row last.
  const members = await deps.groupRepo.listMembers(input.groupId);
  for (const member of members) {
    await deps.userRepo.removeGroupMembership(member.userId, input.groupId);
  }
  await deps.groupCodeRepo.deleteCode(meta.code);
  for (const member of members) {
    await deps.groupRepo.removeMember(input.groupId, member.userId);
  }
  await deps.groupRepo.deleteGroupMeta(input.groupId);
  await deps.groupExpiryRepo.deleteExpiryRow(bucketDateOf(meta.endsAt), input.groupId);

  const now = deps.clock.now();
  await deps.usageRepo.increment(input.familyId ?? input.uid, "apiCalls", usageDate(now));
}
