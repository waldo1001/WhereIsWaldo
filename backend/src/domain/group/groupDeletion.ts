// Shared physical-deletion mechanics for a group's footprint (005 §2.4, 002 §4.1 step 3).
// Extracted so the owner-triggered synchronous delete (001 §12.5, deleteGroup.ts) and the
// sweeper's per-policy deletion (002 §4.1, groupSweeper.ts, B12) perform the exact same
// teardown instead of two independent implementations drifting apart. Pure domain logic: no
// Azure/Google imports.
//
// Deliberately does NOT touch the `GroupExpiry` row: callers know their own row's current
// bucket (the owner-delete path assumes `date(meta.endsAt)`; the sweeper knows the exact
// bucket it just scanned, which may differ if a prior partial move re-bucketed the row) —
// each caller deletes its own expiry row LAST, after this returns, per 002 §4.1's ordering.

import type { GroupCodeRepo, GroupLastKnownRepo, GroupMeta, GroupRepo, UserRepo } from "../../ports/repositories";

export interface HardDeleteGroupFootprintDeps {
  groupRepo: GroupRepo;
  groupCodeRepo: GroupCodeRepo;
  groupLastKnownRepo: GroupLastKnownRepo;
  userRepo: UserRepo;
}

/**
 * Tears down everything EXCEPT the `GroupExpiry` row: the roster's reverse-index rows, the
 * `GroupLastKnown` partition, the `GroupCodes` row, every `Groups` member row, and the
 * `Groups` meta row — in that order (002 §4.1 step 3), so a crash mid-way is safe to re-run
 * (every delete is idempotent/404-swallowing at the adapter layer).
 */
export async function hardDeleteGroupFootprint(meta: GroupMeta, deps: HardDeleteGroupFootprintDeps): Promise<void> {
  const members = await deps.groupRepo.listMembers(meta.groupId);
  for (const member of members) {
    await deps.userRepo.removeGroupMembership(member.userId, meta.groupId);
  }
  await deps.groupLastKnownRepo.deletePartition(meta.groupId);
  await deps.groupCodeRepo.deleteCode(meta.code);
  for (const member of members) {
    await deps.groupRepo.removeMember(meta.groupId, member.userId);
  }
  await deps.groupRepo.deleteGroupMeta(meta.groupId);
}

export interface WipeGroupLocationsAndCodeDeps {
  groupCodeRepo: GroupCodeRepo;
  groupLastKnownRepo: GroupLastKnownRepo;
}

/**
 * The `grace`/`archive` at-`endsAt` cleanup (002 §4.1 steps 4-5): "locations and joinability
 * die" while meta + member rows survive as a memento (archive) or await the grace deadline.
 */
export async function wipeGroupLocationsAndCode(meta: GroupMeta, deps: WipeGroupLocationsAndCodeDeps): Promise<void> {
  await deps.groupLastKnownRepo.deletePartition(meta.groupId);
  await deps.groupCodeRepo.deleteCode(meta.code);
}
