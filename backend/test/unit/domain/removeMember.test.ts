import { describe, expect, it } from "vitest";
import { removeMember } from "../../../src/domain/family/removeMember";
import { InMemoryFamilyRepo } from "../../fakes/inMemoryFamilyRepo";
import { InMemoryUserRepo } from "../../fakes/inMemoryUserRepo";
import { InMemoryDeviceRepo } from "../../fakes/inMemoryDeviceRepo";
import { InMemoryUsageRepo } from "../../fakes/inMemoryUsageRepo";
import { FixedClock } from "../../fakes/fixedClock";
import { expectAppError } from "../../support/expectAppError";

const FAMILY_ID = "fam_9J2Kq7Lm3NpR5sTvWxYz";

function buildDeps() {
  return {
    familyRepo: new InMemoryFamilyRepo(),
    userRepo: new InMemoryUserRepo(),
    deviceRepo: new InMemoryDeviceRepo(),
    usageRepo: new InMemoryUsageRepo(),
    clock: new FixedClock(new Date("2026-07-19T09:00:00Z")),
  };
}

async function seedTwoParentFamily(deps: ReturnType<typeof buildDeps>) {
  await deps.familyRepo.createFamily({
    familyId: FAMILY_ID,
    familyName: "Wauters",
    createdBy: "u1",
    createdAt: "2026-07-19T08:00:00Z",
  });
  await deps.familyRepo.addMember(FAMILY_ID, {
    userId: "u1",
    role: "parent",
    displayName: "Eric",
    joinedAt: "2026-07-19T08:00:00Z",
  });
  await deps.familyRepo.addMember(FAMILY_ID, {
    userId: "u2",
    role: "parent",
    displayName: "Noor",
    joinedAt: "2026-07-19T08:30:00Z",
  });
  await deps.userRepo.createProfile("u1", { familyId: FAMILY_ID, role: "parent", displayName: "Eric" });
  await deps.userRepo.createProfile("u2", { familyId: FAMILY_ID, role: "parent", displayName: "Noor" });
}

// specs/002 §2.4 (B8 re-key) — Devices are keyed by ownerUserId, never familyId: seeds
// under the owner's own partition.
function seedDevice(
  deps: ReturnType<typeof buildDeps>,
  deviceId: string,
  ownerUserId: string,
): void {
  deps.deviceRepo.seed(ownerUserId, {
    deviceId,
    ownerUserId,
    platform: "android",
    model: "Pixel",
    appVersion: "1.0.0",
    deviceName: "Pixel",
    pushInvalid: false,
    syncIntervalMinutes: 15,
    trackingEnabled: true,
    registeredAt: "2026-07-01T00:00:00Z",
    lastSeenAt: "2026-07-01T00:00:00Z",
  });
}

describe("domain/family/removeMember", () => {
  it("removes the member row, the profile, and the member's device registrations (own per-owner partition, 002 §2.4)", async () => {
    const deps = buildDeps();
    await seedTwoParentFamily(deps);
    seedDevice(deps, "device-u2-a", "u2");
    seedDevice(deps, "device-u2-b", "u2");
    seedDevice(deps, "device-u1-a", "u1");

    await removeMember({ uid: "u1", familyId: FAMILY_ID, role: "parent", targetUserId: "u2" }, deps);

    const members = await deps.familyRepo.listMembers(FAMILY_ID);
    expect(members.map((m) => m.userId)).toEqual(["u1"]);
    expect(await deps.userRepo.getProfile("u2")).toBeNull();
    // The removed member's ENTIRE partition is gone...
    expect(await deps.deviceRepo.listDevices("u2")).toEqual([]);
    // ...but the remaining member's own partition is untouched.
    const remainingDevices = await deps.deviceRepo.listDevices("u1");
    expect(remainingDevices.map((d) => d.deviceId)).toEqual(["device-u1-a"]);
  });

  it("records usage metric apiCalls", async () => {
    const deps = buildDeps();
    await seedTwoParentFamily(deps);

    await removeMember({ uid: "u1", familyId: FAMILY_ID, role: "parent", targetUserId: "u2" }, deps);

    const count = await deps.usageRepo.get(FAMILY_ID, "apiCalls", "2026-07-19");
    expect(count).toBe(1);
  });

  it("throws FAMILY_NOT_FOUND when the caller has no family", async () => {
    const deps = buildDeps();

    await expectAppError(
      removeMember({ uid: "u1", familyId: null, role: null, targetUserId: "u2" }, deps),
      "FAMILY_NOT_FOUND",
    );
  });

  it("throws AUTH_FORBIDDEN when the caller is not a parent", async () => {
    const deps = buildDeps();
    await seedTwoParentFamily(deps);

    await expectAppError(
      removeMember({ uid: "u1", familyId: FAMILY_ID, role: "member", targetUserId: "u2" }, deps),
      "AUTH_FORBIDDEN",
    );
  });

  it("throws MEMBER_NOT_FOUND when the target userId is not in the family", async () => {
    const deps = buildDeps();
    await seedTwoParentFamily(deps);

    await expectAppError(
      removeMember({ uid: "u1", familyId: FAMILY_ID, role: "parent", targetUserId: "ghost" }, deps),
      "MEMBER_NOT_FOUND",
    );
  });

  it('throws VALIDATION_FAILED with details.reason "lastParent" when the only parent removes themselves', async () => {
    const deps = buildDeps();
    await deps.familyRepo.createFamily({
      familyId: FAMILY_ID,
      familyName: "Wauters",
      createdBy: "u1",
      createdAt: "2026-07-19T08:00:00Z",
    });
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u1",
      role: "parent",
      displayName: "Eric",
      joinedAt: "2026-07-19T08:00:00Z",
    });
    await deps.userRepo.createProfile("u1", { familyId: FAMILY_ID, role: "parent", displayName: "Eric" });

    await expectAppError(
      removeMember({ uid: "u1", familyId: FAMILY_ID, role: "parent", targetUserId: "u1" }, deps),
      "VALIDATION_FAILED",
      { reason: "lastParent" },
    );
  });

  it('throws "lastParent" for the only parent removing themselves even with other (non-parent) members present', async () => {
    const deps = buildDeps();
    await deps.familyRepo.createFamily({
      familyId: FAMILY_ID,
      familyName: "Wauters",
      createdBy: "u1",
      createdAt: "2026-07-19T08:00:00Z",
    });
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u1",
      role: "parent",
      displayName: "Eric",
      joinedAt: "2026-07-19T08:00:00Z",
    });
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u2",
      role: "member",
      displayName: "Noor",
      joinedAt: "2026-07-19T08:30:00Z",
    });
    await deps.userRepo.createProfile("u1", { familyId: FAMILY_ID, role: "parent", displayName: "Eric" });
    await deps.userRepo.createProfile("u2", { familyId: FAMILY_ID, role: "member", displayName: "Noor" });

    // Total member count is 2, but only 1 is a parent — the count MUST be parent-filtered.
    await expectAppError(
      removeMember({ uid: "u1", familyId: FAMILY_ID, role: "parent", targetUserId: "u1" }, deps),
      "VALIDATION_FAILED",
      { reason: "lastParent" },
    );
  });

  it("allows a parent to remove another parent when a parent remains afterward", async () => {
    const deps = buildDeps();
    await seedTwoParentFamily(deps);

    await removeMember({ uid: "u1", familyId: FAMILY_ID, role: "parent", targetUserId: "u2" }, deps);

    const members = await deps.familyRepo.listMembers(FAMILY_ID);
    expect(members.map((m) => m.userId)).toEqual(["u1"]);
  });

  it("allows removing a non-parent member regardless of parent count", async () => {
    const deps = buildDeps();
    await deps.familyRepo.createFamily({
      familyId: FAMILY_ID,
      familyName: "Wauters",
      createdBy: "u1",
      createdAt: "2026-07-19T08:00:00Z",
    });
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u1",
      role: "parent",
      displayName: "Eric",
      joinedAt: "2026-07-19T08:00:00Z",
    });
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u2",
      role: "member",
      displayName: "Noor",
      joinedAt: "2026-07-19T08:30:00Z",
    });
    await deps.userRepo.createProfile("u1", { familyId: FAMILY_ID, role: "parent", displayName: "Eric" });
    await deps.userRepo.createProfile("u2", { familyId: FAMILY_ID, role: "member", displayName: "Noor" });

    await removeMember({ uid: "u1", familyId: FAMILY_ID, role: "parent", targetUserId: "u2" }, deps);

    const members = await deps.familyRepo.listMembers(FAMILY_ID);
    expect(members.map((m) => m.userId)).toEqual(["u1"]);
  });
});
