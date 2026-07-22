import { describe, expect, it } from "vitest";
import { getLocationHistory } from "../../../src/domain/history/getLocationHistory";
import { getFeatures } from "../../../src/domain/plan";
import { InMemoryHistoryStore } from "../../fakes/inMemoryHistoryStore";
import { InMemoryEntitlementsRepo } from "../../fakes/inMemoryEntitlementsRepo";
import { FixedClock } from "../../fakes/fixedClock";
import { expectAppError } from "../../support/expectAppError";
import type { FixLine } from "../../../src/ports/historyStore";

const FAMILY_ID = "fam_9J2Kq7Lm3NpR5sTvWxYz";
const USER_ID = "u1";
const DEVICE_ID = "device-1";
const OTHER_DEVICE_ID = "device-2";
const NOW = "2026-07-19T09:30:00Z";

function buildDeps() {
  const entitlementsRepo = new InMemoryEntitlementsRepo();
  entitlementsRepo.seed(FAMILY_ID, { subscriptionStatus: "free", updatedAt: "2026-07-01T00:00:00Z" });
  return {
    historyStore: new InMemoryHistoryStore(),
    entitlementsRepo,
    clock: new FixedClock(new Date(NOW)),
  };
}

function fixLine(overrides: Partial<FixLine> = {}): FixLine {
  return {
    fixId: "fix-0000-0000-0000-000000000001",
    recordedAt: "2026-07-19T09:00:00Z",
    receivedAt: "2026-07-19T09:00:02Z",
    lat: 51.0543,
    lon: 3.7174,
    accuracyM: 12.5,
    batteryPct: 78,
    source: "periodic",
    ...overrides,
  };
}

describe("domain/history/getLocationHistory (001 §5.3)", () => {
  it("throws FAMILY_NOT_FOUND when the caller has no family", async () => {
    const deps = buildDeps();

    await expectAppError(
      getLocationHistory(
        { familyId: null, query: { userId: USER_ID, from: "2026-07-01", to: "2026-07-19" } },
        deps,
      ),
      "FAMILY_NOT_FOUND",
    );
  });

  it("throws INTERNAL_ERROR when the family has no Entitlements record", async () => {
    const deps = {
      historyStore: new InMemoryHistoryStore(),
      entitlementsRepo: new InMemoryEntitlementsRepo(), // not seeded
      clock: new FixedClock(new Date(NOW)),
    };

    await expectAppError(
      getLocationHistory(
        { familyId: FAMILY_ID, query: { userId: USER_ID, from: "2026-07-01", to: "2026-07-19" } },
        deps,
      ),
      "INTERNAL_ERROR",
    );
  });

  it("throws VALIDATION_FAILED for a date span exceeding 31 days", async () => {
    const deps = buildDeps();

    await expectAppError(
      getLocationHistory(
        { familyId: FAMILY_ID, query: { userId: USER_ID, from: "2026-06-01", to: "2026-07-19" } },
        deps,
      ),
      "VALIDATION_FAILED",
      { fields: ["from", "to"] },
    );
  });

  it("throws VALIDATION_FAILED with reason beyondRetention past features.limits.historyDays", async () => {
    const deps = buildDeps();
    // free plan historyDays = 90; NOW = 2026-07-19 -> earliest allowed from = 2026-04-20.
    await expectAppError(
      getLocationHistory(
        { familyId: FAMILY_ID, query: { userId: USER_ID, from: "2026-04-01", to: "2026-04-01" } },
        deps,
      ),
      "VALIDATION_FAILED",
      { reason: "beyondRetention" },
    );
  });

  it("throws VALIDATION_FAILED for limit out of the 1-500 range", async () => {
    const deps = buildDeps();

    await expectAppError(
      getLocationHistory(
        { familyId: FAMILY_ID, query: { userId: USER_ID, from: "2026-07-19", to: "2026-07-19", limit: 501 } },
        deps,
      ),
      "VALIDATION_FAILED",
    );
  });

  it("defaults limit to 500 when omitted", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendFix(FAMILY_ID, USER_ID, DEVICE_ID, fixLine());

    const result = await getLocationHistory(
      { familyId: FAMILY_ID, query: { userId: USER_ID, from: "2026-07-19", to: "2026-07-19" } },
      deps,
    );

    expect(result.points).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it("returns points ordered ascending by recordedAt regardless of append order", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendFix(
      FAMILY_ID,
      USER_ID,
      DEVICE_ID,
      fixLine({ fixId: "fix-3", recordedAt: "2026-07-19T09:10:00Z" }),
    );
    await deps.historyStore.appendFix(
      FAMILY_ID,
      USER_ID,
      DEVICE_ID,
      fixLine({ fixId: "fix-1", recordedAt: "2026-07-19T09:00:00Z" }),
    );
    await deps.historyStore.appendFix(
      FAMILY_ID,
      USER_ID,
      DEVICE_ID,
      fixLine({ fixId: "fix-2", recordedAt: "2026-07-19T09:05:00Z" }),
    );

    const result = await getLocationHistory(
      { familyId: FAMILY_ID, query: { userId: USER_ID, from: "2026-07-19", to: "2026-07-19" } },
      deps,
    );

    expect(result.points.map((p) => p.recordedAt)).toEqual([
      "2026-07-19T09:00:00Z",
      "2026-07-19T09:05:00Z",
      "2026-07-19T09:10:00Z",
    ]);
  });

  it("merges multiple devices for the user when deviceId is omitted", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendFix(
      FAMILY_ID,
      USER_ID,
      DEVICE_ID,
      fixLine({ fixId: "fix-a", recordedAt: "2026-07-19T09:00:00Z" }),
    );
    await deps.historyStore.appendFix(
      FAMILY_ID,
      USER_ID,
      OTHER_DEVICE_ID,
      fixLine({ fixId: "fix-b", recordedAt: "2026-07-19T09:05:00Z" }),
    );

    const result = await getLocationHistory(
      { familyId: FAMILY_ID, query: { userId: USER_ID, from: "2026-07-19", to: "2026-07-19" } },
      deps,
    );

    expect(result.points.map((p) => p.deviceId).sort()).toEqual([DEVICE_ID, OTHER_DEVICE_ID]);
  });

  it("filters to a single device when deviceId is given", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendFix(FAMILY_ID, USER_ID, DEVICE_ID, fixLine({ fixId: "fix-a" }));
    await deps.historyStore.appendFix(FAMILY_ID, USER_ID, OTHER_DEVICE_ID, fixLine({ fixId: "fix-b" }));

    const result = await getLocationHistory(
      {
        familyId: FAMILY_ID,
        query: { userId: USER_ID, deviceId: DEVICE_ID, from: "2026-07-19", to: "2026-07-19" },
      },
      deps,
    );

    expect(result.points.map((p) => p.deviceId)).toEqual([DEVICE_ID]);
  });

  it("returns an empty result (not an error) for an unknown userId", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendFix(FAMILY_ID, USER_ID, DEVICE_ID, fixLine());

    const result = await getLocationHistory(
      { familyId: FAMILY_ID, query: { userId: "someone-unknown", from: "2026-07-19", to: "2026-07-19" } },
      deps,
    );

    expect(result.points).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("returns a removed member's retained history (userId is not membership-checked)", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendFix(FAMILY_ID, "removed-member", DEVICE_ID, fixLine());

    const result = await getLocationHistory(
      { familyId: FAMILY_ID, query: { userId: "removed-member", from: "2026-07-19", to: "2026-07-19" } },
      deps,
    );

    expect(result.points).toHaveLength(1);
  });

  it("cursor round-trip: a small limit page followed by the returned cursor yields the rest, no dup/skip", async () => {
    const deps = buildDeps();
    for (let i = 0; i < 5; i++) {
      await deps.historyStore.appendFix(
        FAMILY_ID,
        USER_ID,
        DEVICE_ID,
        fixLine({ fixId: `fix-${i}`, recordedAt: `2026-07-19T09:0${i}:00Z` }),
      );
    }

    const page1 = await getLocationHistory(
      { familyId: FAMILY_ID, query: { userId: USER_ID, from: "2026-07-19", to: "2026-07-19", limit: 2 } },
      deps,
    );
    expect(page1.points).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await getLocationHistory(
      {
        familyId: FAMILY_ID,
        query: {
          userId: USER_ID,
          from: "2026-07-19",
          to: "2026-07-19",
          limit: 2,
          cursor: page1.nextCursor,
        },
      },
      deps,
    );
    expect(page2.points).toHaveLength(2);
    expect(page2.nextCursor).not.toBeNull();

    const page3 = await getLocationHistory(
      {
        familyId: FAMILY_ID,
        query: {
          userId: USER_ID,
          from: "2026-07-19",
          to: "2026-07-19",
          limit: 2,
          cursor: page2.nextCursor,
        },
      },
      deps,
    );
    expect(page3.points).toHaveLength(1);
    expect(page3.nextCursor).toBeNull();

    const allFixIds = [...page1.points, ...page2.points, ...page3.points].map((p) => p.recordedAt);
    expect(allFixIds).toEqual([
      "2026-07-19T09:00:00Z",
      "2026-07-19T09:01:00Z",
      "2026-07-19T09:02:00Z",
      "2026-07-19T09:03:00Z",
      "2026-07-19T09:04:00Z",
    ]);
  });

  it("point shape is exactly deviceId/recordedAt/lat/lon/accuracyM/batteryPct/source (no receivedAt/altitude leak)", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendFix(
      FAMILY_ID,
      USER_ID,
      DEVICE_ID,
      fixLine({ altitudeM: 8.0, speedMps: 1.5, bearingDeg: 90 }),
    );

    const result = await getLocationHistory(
      { familyId: FAMILY_ID, query: { userId: USER_ID, from: "2026-07-19", to: "2026-07-19" } },
      deps,
    );

    expect(result.points[0]).toEqual({
      deviceId: DEVICE_ID,
      recordedAt: "2026-07-19T09:00:00Z",
      lat: 51.0543,
      lon: 3.7174,
      accuracyM: 12.5,
      batteryPct: 78,
      source: "periodic",
    });
  });

  it("returns features derived from PLAN_MATRIX.free", async () => {
    const deps = buildDeps();

    const result = await getLocationHistory(
      { familyId: FAMILY_ID, query: { userId: USER_ID, from: "2026-07-19", to: "2026-07-19" } },
      deps,
    );

    expect(result.features).toEqual(getFeatures("free"));
  });
});
