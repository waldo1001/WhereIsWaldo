import { describe, expect, it } from "vitest";
import { getGroupLatestLocations } from "../../../src/domain/group/getGroupLatestLocations";
import { getFeatures } from "../../../src/domain/plan";
import { InMemoryGroupRepo } from "../../fakes/inMemoryGroupRepo";
import { InMemoryGroupLastKnownRepo } from "../../fakes/inMemoryGroupLastKnownRepo";
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
}

describe("domain/group/getGroupLatestLocations", () => {
  it("throws GROUP_NOT_FOUND for a nonexistent group", async () => {
    const deps = buildDeps();

    await expectAppError(
      getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_nope" }, deps),
      "GROUP_NOT_FOUND",
    );
  });

  it("throws GROUP_NOT_FOUND for a caller who is not a member (masked, indistinguishable from nonexistent)", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await expectAppError(
      getGroupLatestLocations({ uid: "u404", familyId: null, groupId: "grp_a" }, deps),
      "GROUP_NOT_FOUND",
    );
  });

  it("throws GROUP_NOT_FOUND when meta is gone but an orphaned member row survives (crash mid-sweep)", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);
    deps.groupRepo.deleteMetaOnlyForTest("grp_a");

    await expectAppError(
      getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_a" }, deps),
      "GROUP_NOT_FOUND",
    );
  });

  it("masks non-membership as GROUP_NOT_FOUND even when the group has actually expired (membership check runs first)", async () => {
    const deps = buildDeps();
    const expiredMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-01-01T00:00:00Z", expiryPolicy: "delete" };
    await seed(deps, expiredMeta);

    await expectAppError(
      getGroupLatestLocations({ uid: "u404", familyId: null, groupId: "grp_a" }, deps),
      "GROUP_NOT_FOUND",
    );
  });

  it("returns every member with location: null when nobody has reported yet (roster parity, 001 §12.10)", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    const result = await getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_a" }, deps);

    expect(result.members).toEqual([
      { userId: "u1", displayName: "Eric", role: "owner", location: null },
      { userId: "u9", displayName: "Noor", role: "member", location: null },
    ]);
  });

  it("returns a position-only location for a member who has reported (no deviceId/batteryPct/source)", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);
    deps.groupLastKnownRepo.seed("grp_a", {
      userId: "u9",
      lat: 51.0543,
      lon: 3.7174,
      accuracyM: 15.0,
      recordedAt: "2026-07-21T09:58:00Z",
      receivedAt: "2026-07-21T09:58:02Z",
      syncIntervalMinutes: 15,
    });

    const result = await getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_a" }, deps);

    const noor = result.members.find((m) => m.userId === "u9");
    expect(noor?.location).toEqual({
      lat: 51.0543,
      lon: 3.7174,
      accuracyM: 15.0,
      recordedAt: "2026-07-21T09:58:00Z",
      receivedAt: "2026-07-21T09:58:02Z",
      isStale: false,
    });
    expect(Object.keys(noor?.location as object)).not.toContain("deviceId");
    expect(Object.keys(noor?.location as object)).not.toContain("batteryPct");
    expect(Object.keys(noor?.location as object)).not.toContain("source");
  });

  it("isStale formula: exactly 2x the frozen syncIntervalMinutes old is NOT stale (strict >)", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);
    deps.groupLastKnownRepo.seed("grp_a", {
      userId: "u9",
      lat: 1,
      lon: 1,
      accuracyM: 5,
      recordedAt: "2026-07-21T09:30:00Z", // exactly 30 min before NOW (2 * 15)
      receivedAt: "2026-07-21T09:30:01Z",
      syncIntervalMinutes: 15,
    });

    const result = await getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_a" }, deps);

    expect(result.members.find((m) => m.userId === "u9")?.location?.isStale).toBe(false);
  });

  it("isStale formula: one minute past 2x the frozen syncIntervalMinutes IS stale", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);
    deps.groupLastKnownRepo.seed("grp_a", {
      userId: "u9",
      lat: 1,
      lon: 1,
      accuracyM: 5,
      recordedAt: "2026-07-21T09:29:00Z", // 31 min before NOW (> 2 * 15)
      receivedAt: "2026-07-21T09:29:01Z",
      syncIntervalMinutes: 15,
    });

    const result = await getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_a" }, deps);

    expect(result.members.find((m) => m.userId === "u9")?.location?.isStale).toBe(true);
  });

  it("isStale uses the syncIntervalMinutes frozen into the position, not any current device setting", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);
    deps.groupLastKnownRepo.seed("grp_a", {
      userId: "u9",
      lat: 1,
      lon: 1,
      accuracyM: 5,
      recordedAt: "2026-07-21T09:00:00Z", // 60 min before NOW
      receivedAt: "2026-07-21T09:00:01Z",
      syncIntervalMinutes: 60, // frozen wide interval -> threshold 120 min -> NOT stale
    });

    const result = await getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_a" }, deps);

    expect(result.members.find((m) => m.userId === "u9")?.location?.isStale).toBe(false);
  });

  it("throws GROUP_EXPIRED for an ended (grace) group", async () => {
    const deps = buildDeps();
    const graceMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-07-20T00:00:00Z", expiryPolicy: "grace" };
    await seed(deps, graceMeta);

    await expectAppError(
      getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_a" }, deps),
      "GROUP_EXPIRED",
    );
  });

  it("throws GROUP_EXPIRED for an archived group", async () => {
    const deps = buildDeps();
    const archiveMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-01-01T00:00:00Z", expiryPolicy: "archive" };
    await seed(deps, archiveMeta);

    await expectAppError(
      getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_a" }, deps),
      "GROUP_EXPIRED",
    );
  });

  it("throws GROUP_EXPIRED for an expired (delete-policy, past endsAt) group, even for the owner", async () => {
    const deps = buildDeps();
    const expiredMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-01-02T00:00:00Z", expiryPolicy: "delete" };
    await seed(deps, expiredMeta);

    await expectAppError(
      getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_a" }, deps),
      "GROUP_EXPIRED",
    );
  });

  describe("features resolution", () => {
    it("returns implicit free features for a family-less caller", async () => {
      const deps = buildDeps();
      await seed(deps, ACTIVE_META);

      const result = await getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_a" }, deps);

      expect(result.features).toEqual(getFeatures("free"));
    });

    it("resolves features from the family's entitlements when the caller has a family", async () => {
      const deps = buildDeps();
      await seed(deps, ACTIVE_META);
      deps.entitlementsRepo.seed("fam_x", { subscriptionStatus: "active", updatedAt: "2026-07-01T00:00:00Z" });

      const result = await getGroupLatestLocations({ uid: "u1", familyId: "fam_x", groupId: "grp_a" }, deps);

      expect(result.features).toEqual(getFeatures("active"));
    });

    it("throws INTERNAL_ERROR when the caller's family has no Entitlements record", async () => {
      const deps = buildDeps();
      await seed(deps, ACTIVE_META);

      await expectAppError(
        getGroupLatestLocations({ uid: "u1", familyId: "fam_no_ent", groupId: "grp_a" }, deps),
        "INTERNAL_ERROR",
      );
    });
  });

  it("records usage metric apiCalls under the caller's familyId when they have one", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);
    deps.entitlementsRepo.seed("fam_x", { subscriptionStatus: "free", updatedAt: "2026-07-01T00:00:00Z" });

    await getGroupLatestLocations({ uid: "u1", familyId: "fam_x", groupId: "grp_a" }, deps);

    expect(await deps.usageRepo.get("fam_x", "apiCalls", "2026-07-21")).toBe(1);
  });

  it("records usage metric apiCalls under the caller's uid when family-less", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await getGroupLatestLocations({ uid: "u1", familyId: null, groupId: "grp_a" }, deps);

    expect(await deps.usageRepo.get("u1", "apiCalls", "2026-07-21")).toBe(1);
  });
});
