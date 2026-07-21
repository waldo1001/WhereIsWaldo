import { describe, expect, it } from "vitest";
import { kickMember } from "../../../src/domain/group/kickMember";
import { InMemoryGroupRepo } from "../../fakes/inMemoryGroupRepo";
import { InMemoryGroupLastKnownRepo } from "../../fakes/inMemoryGroupLastKnownRepo";
import { InMemoryUserRepo } from "../../fakes/inMemoryUserRepo";
import { InMemoryEntitlementsRepo } from "../../fakes/inMemoryEntitlementsRepo";
import { InMemoryUsageRepo } from "../../fakes/inMemoryUsageRepo";
import { FixedClock } from "../../fakes/fixedClock";
import { expectAppError } from "../../support/expectAppError";
import type { GroupMeta } from "../../../src/ports/repositories";

const NOW = new Date("2026-07-21T10:00:00Z");

function buildDeps() {
  return {
    groupRepo: new InMemoryGroupRepo(),
    groupLastKnownRepo: new InMemoryGroupLastKnownRepo(),
    userRepo: new InMemoryUserRepo(),
    entitlementsRepo: new InMemoryEntitlementsRepo(),
    usageRepo: new InMemoryUsageRepo(),
    clock: new FixedClock(NOW),
  };
}

const ACTIVE_META: GroupMeta = {
  groupId: "grp_a",
  name: "Festival crew",
  ownerUserId: "u1",
  createdAt: "2026-07-20T00:00:00Z",
  endsAt: "2026-08-02T22:00:00Z",
  expiryPolicy: "delete",
  code: "ABCD1234",
};

async function seed(deps: ReturnType<typeof buildDeps>, meta: GroupMeta) {
  await deps.groupRepo.createGroupMeta(meta);
  await deps.groupRepo.addMember(meta.groupId, {
    userId: meta.ownerUserId,
    role: "owner",
    displayName: "Eric",
    joinedAt: meta.createdAt,
  });
  await deps.groupRepo.addMember(meta.groupId, {
    userId: "u9",
    role: "member",
    displayName: "Noor",
    joinedAt: meta.createdAt,
  });
  await deps.userRepo.addGroupMembership(meta.ownerUserId, { groupId: meta.groupId, role: "owner", joinedAt: meta.createdAt });
  await deps.userRepo.addGroupMembership("u9", { groupId: meta.groupId, role: "member", joinedAt: meta.createdAt });
}

describe("domain/group/kickMember", () => {
  it("throws GROUP_NOT_FOUND for a nonexistent group", async () => {
    const deps = buildDeps();

    await expectAppError(
      kickMember({ uid: "u1", familyId: null, groupId: "grp_nope", targetUserId: "u9" }, deps),
      "GROUP_NOT_FOUND",
    );
  });

  it("throws GROUP_NOT_FOUND for a caller who is not a member (masked)", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await expectAppError(
      kickMember({ uid: "u404", familyId: null, groupId: "grp_a", targetUserId: "u9" }, deps),
      "GROUP_NOT_FOUND",
    );
  });

  it("throws AUTH_FORBIDDEN when the caller is a member but not the owner", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await expectAppError(
      kickMember({ uid: "u9", familyId: null, groupId: "grp_a", targetUserId: "u1" }, deps),
      "AUTH_FORBIDDEN",
    );
  });

  it('throws VALIDATION_FAILED with details.reason "ownerCannotLeave" when the owner targets themselves', async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await expectAppError(
      kickMember({ uid: "u1", familyId: null, groupId: "grp_a", targetUserId: "u1" }, deps),
      "VALIDATION_FAILED",
      { reason: "ownerCannotLeave" },
    );
  });

  it("throws MEMBER_NOT_FOUND for a target not in the group", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await expectAppError(
      kickMember({ uid: "u1", familyId: null, groupId: "grp_a", targetUserId: "ghost" }, deps),
      "MEMBER_NOT_FOUND",
    );
  });

  it("removes the target's member row and reverse-index row", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await kickMember({ uid: "u1", familyId: null, groupId: "grp_a", targetUserId: "u9" }, deps);

    expect(await deps.groupRepo.getMember("grp_a", "u9")).toBeNull();
    expect(await deps.userRepo.listGroupMemberships("u9")).toEqual([]);
    // Owner's own membership is untouched.
    expect(await deps.groupRepo.getMember("grp_a", "u1")).not.toBeNull();
  });

  it("removes the kicked member's group position immediately (005 §7), leaving the owner's untouched", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);
    deps.groupLastKnownRepo.seed("grp_a", {
      userId: "u9",
      lat: 51.05,
      lon: 3.72,
      accuracyM: 10,
      recordedAt: "2026-07-21T09:00:00Z",
      receivedAt: "2026-07-21T09:00:01Z",
      syncIntervalMinutes: 15,
    });
    deps.groupLastKnownRepo.seed("grp_a", {
      userId: "u1",
      lat: 51.06,
      lon: 3.73,
      accuracyM: 11,
      recordedAt: "2026-07-21T09:00:00Z",
      receivedAt: "2026-07-21T09:00:01Z",
      syncIntervalMinutes: 15,
    });

    await kickMember({ uid: "u1", familyId: null, groupId: "grp_a", targetUserId: "u9" }, deps);

    const positions = await deps.groupLastKnownRepo.listByGroup("grp_a");
    expect(positions.map((p) => p.userId)).toEqual(["u1"]);
  });

  it("works during grace (ended state)", async () => {
    const deps = buildDeps();
    const graceMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-07-20T00:00:00Z", expiryPolicy: "grace" };
    await seed(deps, graceMeta);

    await kickMember({ uid: "u1", familyId: null, groupId: "grp_a", targetUserId: "u9" }, deps);

    expect(await deps.groupRepo.getMember("grp_a", "u9")).toBeNull();
  });

  it("works for an archived group", async () => {
    const deps = buildDeps();
    const archiveMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-01-01T00:00:00Z", expiryPolicy: "archive" };
    await seed(deps, archiveMeta);

    await kickMember({ uid: "u1", familyId: null, groupId: "grp_a", targetUserId: "u9" }, deps);

    expect(await deps.groupRepo.getMember("grp_a", "u9")).toBeNull();
  });

  it("throws GROUP_EXPIRED for an expired (not yet swept) delete-policy group", async () => {
    const deps = buildDeps();
    const expiredMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-01-02T00:00:00Z", expiryPolicy: "delete" };
    await seed(deps, expiredMeta);

    await expectAppError(
      kickMember({ uid: "u1", familyId: null, groupId: "grp_a", targetUserId: "u9" }, deps),
      "GROUP_EXPIRED",
    );
  });

  it("throws GROUP_EXPIRED for a grace-policy group past graceUntil", async () => {
    const deps = buildDeps();
    const expiredMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-01-01T00:00:00Z", expiryPolicy: "grace" };
    await seed(deps, expiredMeta);

    await expectAppError(
      kickMember({ uid: "u1", familyId: null, groupId: "grp_a", targetUserId: "u9" }, deps),
      "GROUP_EXPIRED",
    );
  });

  it("records usage metric apiCalls", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await kickMember({ uid: "u1", familyId: null, groupId: "grp_a", targetUserId: "u9" }, deps);

    expect(await deps.usageRepo.get("u1", "apiCalls", "2026-07-21")).toBe(1);
  });

  it("throws GROUP_NOT_FOUND when meta is gone but an orphaned member row survives (crash mid-sweep)", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);
    deps.groupRepo.deleteMetaOnlyForTest("grp_a");

    await expectAppError(
      kickMember({ uid: "u1", familyId: null, groupId: "grp_a", targetUserId: "u9" }, deps),
      "GROUP_NOT_FOUND",
    );
  });

  it("throws INTERNAL_ERROR when the caller's family has no Entitlements record", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await expectAppError(
      kickMember({ uid: "u1", familyId: "fam_no_ent", groupId: "grp_a", targetUserId: "u9" }, deps),
      "INTERNAL_ERROR",
    );
  });

  it("succeeds when the caller's family has an Entitlements record", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);
    deps.entitlementsRepo.seed("fam_x", { subscriptionStatus: "active", updatedAt: "2026-07-01T00:00:00Z" });

    await kickMember({ uid: "u1", familyId: "fam_x", groupId: "grp_a", targetUserId: "u9" }, deps);

    expect(await deps.groupRepo.getMember("grp_a", "u9")).toBeNull();
  });
});
