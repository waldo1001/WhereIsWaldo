import { describe, expect, it } from "vitest";
import { rotateGroupCode } from "../../../src/domain/group/rotateGroupCode";
import { InMemoryGroupRepo } from "../../fakes/inMemoryGroupRepo";
import { InMemoryGroupCodeRepo } from "../../fakes/inMemoryGroupCodeRepo";
import { InMemoryEntitlementsRepo } from "../../fakes/inMemoryEntitlementsRepo";
import { InMemoryUsageRepo } from "../../fakes/inMemoryUsageRepo";
import { FixedClock } from "../../fakes/fixedClock";
import { SeqInviteCodeGenerator } from "../../fakes/seqInviteCodeGenerator";
import { expectAppError } from "../../support/expectAppError";
import type { GroupMeta } from "../../../src/ports/repositories";

const NOW = new Date("2026-07-21T10:00:00Z");

function buildDeps() {
  return {
    groupRepo: new InMemoryGroupRepo(),
    groupCodeRepo: new InMemoryGroupCodeRepo(),
    entitlementsRepo: new InMemoryEntitlementsRepo(),
    usageRepo: new InMemoryUsageRepo(),
    inviteCodeGenerator: new SeqInviteCodeGenerator(),
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
  await deps.groupCodeRepo.createCode(meta.code, { groupId: meta.groupId, createdAt: meta.createdAt });
}

describe("domain/group/rotateGroupCode", () => {
  it("throws GROUP_NOT_FOUND for a nonexistent group", async () => {
    const deps = buildDeps();

    await expectAppError(
      rotateGroupCode({ uid: "u1", familyId: null, groupId: "grp_nope" }, deps),
      "GROUP_NOT_FOUND",
    );
  });

  it("throws GROUP_NOT_FOUND for a caller who is not a member (masked)", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await expectAppError(
      rotateGroupCode({ uid: "u404", familyId: null, groupId: "grp_a" }, deps),
      "GROUP_NOT_FOUND",
    );
  });

  it("throws AUTH_FORBIDDEN when the caller is a member but not the owner", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await expectAppError(
      rotateGroupCode({ uid: "u9", familyId: null, groupId: "grp_a" }, deps),
      "AUTH_FORBIDDEN",
    );
  });

  it("issues a new code, invalidates the old one instantly, and updates Groups.meta.code", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    const result = await rotateGroupCode({ uid: "u1", familyId: null, groupId: "grp_a" }, deps);

    expect(result.code).toBe("00000001");
    expect(result.rotatedAt).toBe(NOW.toISOString());
    expect(await deps.groupCodeRepo.getCode("ABCD1234")).toBeNull();
    expect(await deps.groupCodeRepo.getCode("00000001")).toEqual({ groupId: "grp_a", createdAt: NOW.toISOString() });
    const meta = await deps.groupRepo.getGroupMeta("grp_a");
    expect(meta?.code).toBe("00000001");
  });

  it("throws GROUP_EXPIRED for an expired (not yet swept) delete-policy group", async () => {
    const deps = buildDeps();
    const expiredMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-01-02T00:00:00Z", expiryPolicy: "delete" };
    await seed(deps, expiredMeta);

    await expectAppError(
      rotateGroupCode({ uid: "u1", familyId: null, groupId: "grp_a" }, deps),
      "GROUP_EXPIRED",
    );
  });

  it("throws GROUP_EXPIRED for a grace-policy group past graceUntil", async () => {
    const deps = buildDeps();
    const expiredMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-01-01T00:00:00Z", expiryPolicy: "grace" };
    await seed(deps, expiredMeta);

    await expectAppError(
      rotateGroupCode({ uid: "u1", familyId: null, groupId: "grp_a" }, deps),
      "GROUP_EXPIRED",
    );
  });

  it("allows rotation for an ended (grace, still within grace) group", async () => {
    const deps = buildDeps();
    const graceMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-07-20T00:00:00Z", expiryPolicy: "grace" };
    await seed(deps, graceMeta);

    const result = await rotateGroupCode({ uid: "u1", familyId: null, groupId: "grp_a" }, deps);

    expect(result.code).toBe("00000001");
  });

  it("allows rotation for an archived group", async () => {
    const deps = buildDeps();
    const archiveMeta: GroupMeta = { ...ACTIVE_META, endsAt: "2026-01-01T00:00:00Z", expiryPolicy: "archive" };
    await seed(deps, archiveMeta);

    const result = await rotateGroupCode({ uid: "u1", familyId: null, groupId: "grp_a" }, deps);

    expect(result.code).toBe("00000001");
  });

  it("records usage metric apiCalls", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await rotateGroupCode({ uid: "u1", familyId: null, groupId: "grp_a" }, deps);

    expect(await deps.usageRepo.get("u1", "apiCalls", "2026-07-21")).toBe(1);
  });

  it("throws GROUP_NOT_FOUND when meta is gone but an orphaned member row survives (crash mid-sweep)", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);
    deps.groupRepo.deleteMetaOnlyForTest("grp_a");

    await expectAppError(
      rotateGroupCode({ uid: "u1", familyId: null, groupId: "grp_a" }, deps),
      "GROUP_NOT_FOUND",
    );
  });

  it("throws INTERNAL_ERROR when the caller's family has no Entitlements record", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);

    await expectAppError(
      rotateGroupCode({ uid: "u1", familyId: "fam_no_ent", groupId: "grp_a" }, deps),
      "INTERNAL_ERROR",
    );
  });

  it("succeeds when the caller's family has an Entitlements record", async () => {
    const deps = buildDeps();
    await seed(deps, ACTIVE_META);
    deps.entitlementsRepo.seed("fam_x", { subscriptionStatus: "active", updatedAt: "2026-07-01T00:00:00Z" });

    const result = await rotateGroupCode({ uid: "u1", familyId: "fam_x", groupId: "grp_a" }, deps);

    expect(result.code).toBe("00000001");
  });
});
