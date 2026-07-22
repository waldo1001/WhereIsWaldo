import { describe, expect, it } from "vitest";
import { getGeofences } from "../../../src/domain/geofence/getGeofences";
import { getFeatures } from "../../../src/domain/plan";
import { InMemoryGeofenceConfigRepo } from "../../fakes/inMemoryGeofenceConfigRepo";
import { InMemoryEntitlementsRepo } from "../../fakes/inMemoryEntitlementsRepo";
import { FixedClock } from "../../fakes/fixedClock";
import { expectAppError } from "../../support/expectAppError";

const FAMILY_ID = "fam_9J2Kq7Lm3NpR5sTvWxYz";
const NOW = "2026-07-19T09:10:00Z";

function buildDeps() {
  const entitlementsRepo = new InMemoryEntitlementsRepo();
  entitlementsRepo.seed(FAMILY_ID, { subscriptionStatus: "free", updatedAt: "2026-07-01T00:00:00Z" });
  return {
    geofenceConfigRepo: new InMemoryGeofenceConfigRepo(),
    entitlementsRepo,
    clock: new FixedClock(new Date(NOW)),
  };
}

describe("domain/geofence/getGeofences", () => {
  it("throws FAMILY_NOT_FOUND when the caller has no family", async () => {
    const deps = buildDeps();
    await expectAppError(getGeofences({ familyId: null, ifNoneMatch: null }, deps), "FAMILY_NOT_FOUND");
  });

  it("throws INTERNAL_ERROR when the family has no Entitlements record", async () => {
    const deps = {
      geofenceConfigRepo: new InMemoryGeofenceConfigRepo(),
      entitlementsRepo: new InMemoryEntitlementsRepo(), // deliberately not seeded
      clock: new FixedClock(new Date(NOW)),
    };
    await expectAppError(getGeofences({ familyId: FAMILY_ID, ifNoneMatch: null }, deps), "INTERNAL_ERROR");
  });

  it("a never-written family returns {version:0, geofences:[]} with etag \"0\"", async () => {
    const deps = buildDeps();

    const result = await getGeofences({ familyId: FAMILY_ID, ifNoneMatch: null }, deps);

    expect(result.notModified).toBe(false);
    expect(result.version).toBe(0);
    expect(result.geofences).toEqual([]);
    expect(result.etag).toBe("0");
    expect(result.features).toEqual(getFeatures("free"));
  });

  it("returns the full stored document + etag when no If-None-Match is sent", async () => {
    const deps = buildDeps();
    deps.geofenceConfigRepo.seedConfig(
      FAMILY_ID,
      {
        version: 4,
        geofences: [
          {
            geofenceId: "gf_home",
            name: "Home",
            lat: 51.0543,
            lon: 3.7174,
            radiusM: 150,
            icon: "home",
            notifyOnEnter: true,
            notifyOnExit: true,
          },
        ],
      },
      '"0x8DC5F3A9B2C1D40"',
    );

    const result = await getGeofences({ familyId: FAMILY_ID, ifNoneMatch: null }, deps);

    expect(result.notModified).toBe(false);
    expect(result.version).toBe(4);
    expect(result.geofences).toHaveLength(1);
    expect(result.geofences[0]).toEqual({
      geofenceId: "gf_home",
      name: "Home",
      lat: 51.0543,
      lon: 3.7174,
      radiusM: 150,
      icon: "home",
      notifyOnEnter: true,
      notifyOnExit: true,
    });
    expect(result.etag).toBe('"0x8DC5F3A9B2C1D40"');
  });

  it("notModified is true when If-None-Match equals the current etag (304 flow)", async () => {
    const deps = buildDeps();
    deps.geofenceConfigRepo.seedConfig(FAMILY_ID, { version: 4, geofences: [] }, '"0x8DC5F3A9B2C1D40"');

    const result = await getGeofences({ familyId: FAMILY_ID, ifNoneMatch: '"0x8DC5F3A9B2C1D40"' }, deps);

    expect(result.notModified).toBe(true);
    expect(result.etag).toBe('"0x8DC5F3A9B2C1D40"');
  });

  it("notModified is false when If-None-Match does not match the current etag", async () => {
    const deps = buildDeps();
    deps.geofenceConfigRepo.seedConfig(FAMILY_ID, { version: 4, geofences: [] }, '"0x8DC5F3A9B2C1D40"');

    const result = await getGeofences({ familyId: FAMILY_ID, ifNoneMatch: '"stale-etag"' }, deps);

    expect(result.notModified).toBe(false);
  });

  it("a never-written family with If-None-Match: \"0\" (the client's cached sentinel) is a 304", async () => {
    const deps = buildDeps();

    const result = await getGeofences({ familyId: FAMILY_ID, ifNoneMatch: "0" }, deps);

    expect(result.notModified).toBe(true);
  });
});
