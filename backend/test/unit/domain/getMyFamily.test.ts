import { describe, expect, it } from "vitest";
import { getMyFamily } from "../../../src/domain/family/getMyFamily";
import { getFeatures } from "../../../src/domain/plan";
import { InMemoryFamilyRepo } from "../../fakes/inMemoryFamilyRepo";
import { InMemoryEntitlementsRepo } from "../../fakes/inMemoryEntitlementsRepo";
import { InMemoryUsageRepo } from "../../fakes/inMemoryUsageRepo";
import { FixedClock } from "../../fakes/fixedClock";
import { expectAppError } from "../../support/expectAppError";

const FAMILY_ID = "fam_9J2Kq7Lm3NpR5sTvWxYz";

function buildDeps() {
  return {
    familyRepo: new InMemoryFamilyRepo(),
    entitlementsRepo: new InMemoryEntitlementsRepo(),
    usageRepo: new InMemoryUsageRepo(),
    clock: new FixedClock(new Date("2026-07-19T09:00:00Z")),
  };
}

async function seedFamily(deps: ReturnType<typeof buildDeps>) {
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
  deps.entitlementsRepo.seed(FAMILY_ID, { subscriptionStatus: "free", updatedAt: "2026-07-19T08:00:00Z" });
}

describe("domain/family/getMyFamily", () => {
  it("returns family meta, me, and the member roster (§3.2 shape)", async () => {
    const deps = buildDeps();
    await seedFamily(deps);

    const result = await getMyFamily({ uid: "u1", familyId: FAMILY_ID }, deps);

    expect(result).toEqual({
      familyId: FAMILY_ID,
      familyName: "Wauters",
      createdAt: "2026-07-19T08:00:00Z",
      me: { userId: "u1", role: "parent" },
      members: [
        { userId: "u1", role: "parent", displayName: "Eric", joinedAt: "2026-07-19T08:00:00Z" },
        { userId: "u2", role: "member", displayName: "Noor", joinedAt: "2026-07-19T08:30:00Z" },
      ],
      features: getFeatures("free"),
    });
  });

  it("derives me for a non-parent caller from the roster", async () => {
    const deps = buildDeps();
    await seedFamily(deps);

    const result = await getMyFamily({ uid: "u2", familyId: FAMILY_ID }, deps);

    expect(result.me).toEqual({ userId: "u2", role: "member" });
  });

  it("records usage metric apiCalls", async () => {
    const deps = buildDeps();
    await seedFamily(deps);

    await getMyFamily({ uid: "u1", familyId: FAMILY_ID }, deps);

    const count = await deps.usageRepo.get(FAMILY_ID, "apiCalls", "2026-07-19");
    expect(count).toBe(1);
  });

  it("throws FAMILY_NOT_FOUND when the caller has no family", async () => {
    const deps = buildDeps();

    await expectAppError(getMyFamily({ uid: "u1", familyId: null }, deps), "FAMILY_NOT_FOUND");
  });

  it("throws INTERNAL_ERROR when the family meta record is missing", async () => {
    const deps = buildDeps();
    // Entitlements ARE seeded (isolating this check from the separate entitlements-missing
    // one below) but familyRepo.createFamily was deliberately never called — getFamilyMeta
    // returns null (data-integrity edge case).
    deps.entitlementsRepo.seed(FAMILY_ID, { subscriptionStatus: "free", updatedAt: "2026-07-19T08:00:00Z" });

    await expectAppError(getMyFamily({ uid: "u1", familyId: FAMILY_ID }, deps), "INTERNAL_ERROR");
  });

  it("throws INTERNAL_ERROR when the family has no Entitlements record", async () => {
    const familyRepo = new InMemoryFamilyRepo();
    await familyRepo.createFamily({
      familyId: FAMILY_ID,
      familyName: "Wauters",
      createdBy: "u1",
      createdAt: "2026-07-19T08:00:00Z",
    });
    await familyRepo.addMember(FAMILY_ID, {
      userId: "u1",
      role: "parent",
      displayName: "Eric",
      joinedAt: "2026-07-19T08:00:00Z",
    });
    const entitlementsRepo = new InMemoryEntitlementsRepo(); // deliberately not seeded
    const usageRepo = new InMemoryUsageRepo();
    const clock = new FixedClock(new Date("2026-07-19T09:00:00Z"));

    await expectAppError(
      getMyFamily({ uid: "u1", familyId: FAMILY_ID }, { familyRepo, entitlementsRepo, usageRepo, clock }),
      "INTERNAL_ERROR",
    );
  });
});
