import { describe, expect, it } from "vitest";
import { listMyDevices } from "../../../src/domain/device/listMyDevices";
import { getFeatures } from "../../../src/domain/plan";
import { InMemoryDeviceRepo } from "../../fakes/inMemoryDeviceRepo";
import { InMemoryFamilyRepo } from "../../fakes/inMemoryFamilyRepo";
import { InMemoryUserRepo } from "../../fakes/inMemoryUserRepo";
import { InMemoryEntitlementsRepo } from "../../fakes/inMemoryEntitlementsRepo";
import { InMemoryUsageRepo } from "../../fakes/inMemoryUsageRepo";
import { FixedClock } from "../../fakes/fixedClock";
import { expectAppError } from "../../support/expectAppError";
import type { DeviceRecord } from "../../../src/ports/repositories";

const FAMILY_ID = "fam_9J2Kq7Lm3NpR5sTvWxYz";

function buildDeps() {
  return {
    deviceRepo: new InMemoryDeviceRepo(),
    familyRepo: new InMemoryFamilyRepo(),
    userRepo: new InMemoryUserRepo(),
    entitlementsRepo: new InMemoryEntitlementsRepo(),
    usageRepo: new InMemoryUsageRepo(),
    clock: new FixedClock(new Date("2026-07-19T09:05:00Z")),
  };
}

function baseDevice(overrides: Partial<DeviceRecord>): DeviceRecord {
  return {
    deviceId: "3e0f2a9c-6b1d-4e8f-9a2b-7c5d4e3f2a1b",
    ownerUserId: "u1",
    platform: "android",
    model: "Pixel",
    appVersion: "1.0.0",
    deviceName: "Pixel",
    pushToken: "some-token",
    pushInvalid: false,
    syncIntervalMinutes: 15,
    trackingEnabled: true,
    registeredAt: "2026-07-01T00:00:00Z",
    lastSeenAt: "2026-07-19T09:00:00Z",
    ...overrides,
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

describe("domain/device/listMyDevices", () => {
  it("lists every family member's devices with ownerDisplayName + lastSeenAt (§4.2 open-family shape)", async () => {
    const deps = buildDeps();
    await seedFamily(deps);
    deps.deviceRepo.seed(FAMILY_ID, baseDevice({ deviceId: "device-1", ownerUserId: "u1" }));
    deps.deviceRepo.seed(FAMILY_ID, baseDevice({ deviceId: "device-2", ownerUserId: "u2", model: "iPhone" }));

    const result = await listMyDevices({ uid: "u1", familyId: FAMILY_ID }, deps);

    expect(result.devices).toHaveLength(2);
    expect(result.devices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ deviceId: "device-1", ownerUserId: "u1", ownerDisplayName: "Eric" }),
        expect.objectContaining({ deviceId: "device-2", ownerUserId: "u2", ownerDisplayName: "Noor" }),
      ]),
    );
    expect(result.features).toEqual(getFeatures("free"));
  });

  it("never leaks pushToken/locationPushToken in the response (write-only, §4.1)", async () => {
    const deps = buildDeps();
    await seedFamily(deps);
    deps.deviceRepo.seed(
      FAMILY_ID,
      baseDevice({ deviceId: "device-1", ownerUserId: "u1", pushToken: "secret-token", locationPushToken: "secret-loc" }),
    );

    const result = await listMyDevices({ uid: "u1", familyId: FAMILY_ID }, deps);

    expect(result.devices[0]).not.toHaveProperty("pushToken");
    expect(result.devices[0]).not.toHaveProperty("locationPushToken");
  });

  it("records usage metric apiCalls under the familyId for a family member", async () => {
    const deps = buildDeps();
    await seedFamily(deps);

    await listMyDevices({ uid: "u1", familyId: FAMILY_ID }, deps);

    const count = await deps.usageRepo.get(FAMILY_ID, "apiCalls", "2026-07-19");
    expect(count).toBe(1);
  });

  it("throws INTERNAL_ERROR when the family has no Entitlements record", async () => {
    const deviceRepo = new InMemoryDeviceRepo();
    const familyRepo = new InMemoryFamilyRepo();
    await familyRepo.createFamily({
      familyId: FAMILY_ID,
      familyName: "Wauters",
      createdBy: "u1",
      createdAt: "2026-07-19T08:00:00Z",
    });
    const userRepo = new InMemoryUserRepo();
    const entitlementsRepo = new InMemoryEntitlementsRepo(); // deliberately not seeded
    const usageRepo = new InMemoryUsageRepo();
    const clock = new FixedClock(new Date("2026-07-19T09:05:00Z"));

    await expectAppError(
      listMyDevices({ uid: "u1", familyId: FAMILY_ID }, { deviceRepo, familyRepo, userRepo, entitlementsRepo, usageRepo, clock }),
      "INTERNAL_ERROR",
    );
  });

  it("returns only the caller's own devices for a family-less caller (§4.2 family-less allowance)", async () => {
    const deps = buildDeps();
    await deps.userRepo.createProfile("u3", { familyId: null, role: null, displayName: "Group-only Sam" });
    deps.deviceRepo.seed("u3", baseDevice({ deviceId: "device-3", ownerUserId: "u3" }));

    const result = await listMyDevices({ uid: "u3", familyId: null }, deps);

    expect(result.devices).toHaveLength(1);
    expect(result.devices[0]).toMatchObject({
      deviceId: "device-3",
      ownerUserId: "u3",
      ownerDisplayName: "Group-only Sam",
    });
    expect(result.features).toEqual(getFeatures("free"));
  });

  it("records usage metric apiCalls under the caller's own uid for a family-less caller (002 §2.9)", async () => {
    const deps = buildDeps();
    await deps.userRepo.createProfile("u3", { familyId: null, role: null, displayName: "Group-only Sam" });

    await listMyDevices({ uid: "u3", familyId: null }, deps);

    const count = await deps.usageRepo.get("u3", "apiCalls", "2026-07-19");
    expect(count).toBe(1);
  });

  it("returns an empty devices array for a family-less caller with no devices yet", async () => {
    const deps = buildDeps();
    await deps.userRepo.createProfile("u3", { familyId: null, role: null, displayName: "Group-only Sam" });

    const result = await listMyDevices({ uid: "u3", familyId: null }, deps);

    expect(result.devices).toEqual([]);
  });
});
