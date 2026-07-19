import { describe, expect, it } from "vitest";
import { latestLocations } from "../../../src/domain/location/latestLocations";
import { getFeatures } from "../../../src/domain/plan";
import { InMemoryFamilyRepo } from "../../fakes/inMemoryFamilyRepo";
import { InMemoryDeviceRepo } from "../../fakes/inMemoryDeviceRepo";
import { InMemoryLastKnownRepo } from "../../fakes/inMemoryLastKnownRepo";
import { InMemoryUsageRepo } from "../../fakes/inMemoryUsageRepo";
import { InMemoryEntitlementsRepo } from "../../fakes/inMemoryEntitlementsRepo";
import { FixedClock } from "../../fakes/fixedClock";
import { expectAppError } from "../../support/expectAppError";
import type { DeviceRecord } from "../../../src/ports/repositories";

const FAMILY_ID = "fam_9J2Kq7Lm3NpR5sTvWxYz";
const NOW = "2026-07-19T09:30:00Z";

function device(overrides: Partial<DeviceRecord>): DeviceRecord {
  return {
    deviceId: "device-1",
    ownerUserId: "u1",
    platform: "android",
    model: "Pixel 8",
    appVersion: "1.0.0",
    deviceName: "Eric's phone",
    pushInvalid: false,
    syncIntervalMinutes: 15,
    trackingEnabled: true,
    registeredAt: "2026-07-01T00:00:00Z",
    lastSeenAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

async function buildDeps() {
  const familyRepo = new InMemoryFamilyRepo();
  await familyRepo.createFamily({
    familyId: FAMILY_ID,
    familyName: "Wauters",
    createdBy: "u1",
    createdAt: "2026-07-01T00:00:00Z",
  });
  const entitlementsRepo = new InMemoryEntitlementsRepo();
  entitlementsRepo.seed(FAMILY_ID, { subscriptionStatus: "free", updatedAt: "2026-07-01T00:00:00Z" });
  return {
    familyRepo,
    deviceRepo: new InMemoryDeviceRepo(),
    lastKnownRepo: new InMemoryLastKnownRepo(),
    usageRepo: new InMemoryUsageRepo(),
    entitlementsRepo,
    clock: new FixedClock(new Date(NOW)),
  };
}

describe("domain/location/latestLocations", () => {
  it("includes every member, even one with no registered devices (devices: [])", async () => {
    const deps = await buildDeps();
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u1",
      role: "parent",
      displayName: "Eric",
      joinedAt: "2026-07-01T00:00:00Z",
    });
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u4",
      role: "member",
      displayName: "DeviceLess",
      joinedAt: "2026-07-01T00:00:00Z",
    });

    const result = await latestLocations({ familyId: FAMILY_ID }, deps);

    const deviceLess = result.members.find((m) => m.userId === "u4");
    expect(deviceLess).toEqual({ userId: "u4", displayName: "DeviceLess", devices: [] });
  });

  it("includes a never-reported device with lat/lon/recordedAt/isStale all null", async () => {
    const deps = await buildDeps();
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u2",
      role: "member",
      displayName: "Noor",
      joinedAt: "2026-07-01T00:00:00Z",
    });
    deps.deviceRepo.seed(FAMILY_ID, device({ deviceId: "d2", ownerUserId: "u2", deviceName: "Noor's phone" }));

    const result = await latestLocations({ familyId: FAMILY_ID }, deps);

    const noor = result.members.find((m) => m.userId === "u2");
    expect(noor?.devices).toEqual([
      {
        deviceId: "d2",
        deviceName: "Noor's phone",
        lat: null,
        lon: null,
        accuracyM: null,
        recordedAt: null,
        receivedAt: null,
        batteryPct: null,
        source: null,
        trackingEnabled: true,
        syncIntervalMinutes: 15,
        isStale: null,
      },
    ]);
  });

  it("reports a fresh device's last-known fix with isStale computed from now - recordedAt", async () => {
    const deps = await buildDeps();
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u1",
      role: "parent",
      displayName: "Eric",
      joinedAt: "2026-07-01T00:00:00Z",
    });
    deps.deviceRepo.seed(FAMILY_ID, device({ deviceId: "d1", ownerUserId: "u1", syncIntervalMinutes: 15 }));
    deps.lastKnownRepo.seed(FAMILY_ID, {
      deviceId: "d1",
      lat: 51.0543,
      lon: 3.7174,
      accuracyM: 15.0,
      batteryPct: 78,
      recordedAt: "2026-07-19T09:05:00Z", // 25 min before NOW; threshold 2*15=30min -> not stale
      receivedAt: "2026-07-19T09:05:02Z",
      source: "periodic",
    });

    const result = await latestLocations({ familyId: FAMILY_ID }, deps);

    const eric = result.members.find((m) => m.userId === "u1");
    expect(eric?.devices).toEqual([
      {
        deviceId: "d1",
        deviceName: "Eric's phone",
        lat: 51.0543,
        lon: 3.7174,
        accuracyM: 15.0,
        recordedAt: "2026-07-19T09:05:00Z",
        receivedAt: "2026-07-19T09:05:02Z",
        batteryPct: 78,
        source: "periodic",
        trackingEnabled: true,
        syncIntervalMinutes: 15,
        isStale: false,
      },
    ]);
  });

  it("isStale formula: exactly 2x syncIntervalMinutes old is NOT stale (strict >)", async () => {
    const deps = await buildDeps();
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u1",
      role: "parent",
      displayName: "Eric",
      joinedAt: "2026-07-01T00:00:00Z",
    });
    deps.deviceRepo.seed(FAMILY_ID, device({ deviceId: "d1", ownerUserId: "u1", syncIntervalMinutes: 15 }));
    deps.lastKnownRepo.seed(FAMILY_ID, {
      deviceId: "d1",
      lat: 51.0,
      lon: 3.7,
      accuracyM: 10,
      batteryPct: 50,
      recordedAt: "2026-07-19T09:00:00Z", // exactly 30 min before NOW (2 * 15)
      receivedAt: "2026-07-19T09:00:01Z",
      source: "periodic",
    });

    const result = await latestLocations({ familyId: FAMILY_ID }, deps);

    const device1 = result.members.find((m) => m.userId === "u1")?.devices[0];
    expect(device1?.isStale).toBe(false);
  });

  it("isStale formula: one minute past 2x syncIntervalMinutes IS stale", async () => {
    const deps = await buildDeps();
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u1",
      role: "parent",
      displayName: "Eric",
      joinedAt: "2026-07-01T00:00:00Z",
    });
    deps.deviceRepo.seed(FAMILY_ID, device({ deviceId: "d1", ownerUserId: "u1", syncIntervalMinutes: 15 }));
    deps.lastKnownRepo.seed(FAMILY_ID, {
      deviceId: "d1",
      lat: 51.0,
      lon: 3.7,
      accuracyM: 10,
      batteryPct: 50,
      recordedAt: "2026-07-19T08:59:00Z", // 31 min before NOW (> 2 * 15)
      receivedAt: "2026-07-19T08:59:01Z",
      source: "periodic",
    });

    const result = await latestLocations({ familyId: FAMILY_ID }, deps);

    const device1 = result.members.find((m) => m.userId === "u1")?.devices[0];
    expect(device1?.isStale).toBe(true);
  });

  it("joins multiple devices for the same member correctly", async () => {
    const deps = await buildDeps();
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u1",
      role: "parent",
      displayName: "Eric",
      joinedAt: "2026-07-01T00:00:00Z",
    });
    deps.deviceRepo.seed(FAMILY_ID, device({ deviceId: "d1", ownerUserId: "u1" }));
    deps.deviceRepo.seed(FAMILY_ID, device({ deviceId: "d2", ownerUserId: "u1", deviceName: "Eric's tablet" }));

    const result = await latestLocations({ familyId: FAMILY_ID }, deps);

    const eric = result.members.find((m) => m.userId === "u1");
    expect(eric?.devices.map((d) => d.deviceId).sort()).toEqual(["d1", "d2"]);
  });

  it("increments the apiCalls usage metric", async () => {
    const deps = await buildDeps();
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u1",
      role: "parent",
      displayName: "Eric",
      joinedAt: "2026-07-01T00:00:00Z",
    });

    await latestLocations({ familyId: FAMILY_ID }, deps);

    expect(await deps.usageRepo.get(FAMILY_ID, "apiCalls", "2026-07-19")).toBe(1);
  });

  it("throws FAMILY_NOT_FOUND when the caller has no family", async () => {
    const deps = await buildDeps();

    await expectAppError(latestLocations({ familyId: null }, deps), "FAMILY_NOT_FOUND");
  });

  it("returns features derived from PLAN_MATRIX.free", async () => {
    const deps = await buildDeps();
    await deps.familyRepo.addMember(FAMILY_ID, {
      userId: "u1",
      role: "parent",
      displayName: "Eric",
      joinedAt: "2026-07-01T00:00:00Z",
    });

    const result = await latestLocations({ familyId: FAMILY_ID }, deps);

    expect(result.features).toEqual(getFeatures("free"));
  });

  it("throws INTERNAL_ERROR when the family has no Entitlements record", async () => {
    const familyRepo = new InMemoryFamilyRepo();
    await familyRepo.createFamily({
      familyId: FAMILY_ID,
      familyName: "Wauters",
      createdBy: "u1",
      createdAt: "2026-07-01T00:00:00Z",
    });
    const deps = {
      familyRepo,
      deviceRepo: new InMemoryDeviceRepo(),
      lastKnownRepo: new InMemoryLastKnownRepo(),
      usageRepo: new InMemoryUsageRepo(),
      entitlementsRepo: new InMemoryEntitlementsRepo(), // deliberately not seeded
      clock: new FixedClock(new Date(NOW)),
    };

    await expectAppError(latestLocations({ familyId: FAMILY_ID }, deps), "INTERNAL_ERROR");
  });
});
