import { describe, expect, it } from "vitest";
import { getGeofenceEventHistory } from "../../../src/domain/history/getGeofenceEventHistory";
import { getFeatures } from "../../../src/domain/plan";
import { InMemoryHistoryStore } from "../../fakes/inMemoryHistoryStore";
import { InMemoryEntitlementsRepo } from "../../fakes/inMemoryEntitlementsRepo";
import { FixedClock } from "../../fakes/fixedClock";
import { expectAppError } from "../../support/expectAppError";
import type { EventLine } from "../../../src/ports/historyStore";

const FAMILY_ID = "fam_9J2Kq7Lm3NpR5sTvWxYz";
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

function eventLine(overrides: Partial<EventLine> = {}): EventLine {
  return {
    eventId: "event-0000-0000-0000-000000000001",
    userId: "u2",
    deviceId: "device-1",
    geofenceId: "gf_home",
    geofenceName: "Home",
    lat: 51.0543,
    lon: 3.7174,
    radiusM: 150,
    transition: "enter",
    recordedAt: "2026-07-19T15:03:22Z",
    receivedAt: "2026-07-19T15:03:24Z",
    ...overrides,
  };
}

describe("domain/history/getGeofenceEventHistory (001 §7.4)", () => {
  it("throws FAMILY_NOT_FOUND when the caller has no family", async () => {
    const deps = buildDeps();

    await expectAppError(
      getGeofenceEventHistory({ familyId: null, query: { from: "2026-07-19", to: "2026-07-19" } }, deps),
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
      getGeofenceEventHistory({ familyId: FAMILY_ID, query: { from: "2026-07-19", to: "2026-07-19" } }, deps),
      "INTERNAL_ERROR",
    );
  });

  it("throws VALIDATION_FAILED for a date span exceeding 31 days", async () => {
    const deps = buildDeps();

    await expectAppError(
      getGeofenceEventHistory(
        { familyId: FAMILY_ID, query: { from: "2026-06-01", to: "2026-07-19" } },
        deps,
      ),
      "VALIDATION_FAILED",
      { fields: ["from", "to"] },
    );
  });

  it("throws VALIDATION_FAILED with reason beyondRetention past features.limits.historyDays", async () => {
    const deps = buildDeps();

    await expectAppError(
      getGeofenceEventHistory(
        { familyId: FAMILY_ID, query: { from: "2026-04-01", to: "2026-04-01" } },
        deps,
      ),
      "VALIDATION_FAILED",
      { reason: "beyondRetention" },
    );
  });

  it("returns events ordered ascending by recordedAt regardless of append order", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendEvent(
      FAMILY_ID,
      eventLine({ eventId: "e3", recordedAt: "2026-07-19T15:10:00Z" }),
    );
    await deps.historyStore.appendEvent(
      FAMILY_ID,
      eventLine({ eventId: "e1", recordedAt: "2026-07-19T15:00:00Z" }),
    );
    await deps.historyStore.appendEvent(
      FAMILY_ID,
      eventLine({ eventId: "e2", recordedAt: "2026-07-19T15:05:00Z" }),
    );

    const result = await getGeofenceEventHistory(
      { familyId: FAMILY_ID, query: { from: "2026-07-19", to: "2026-07-19" } },
      deps,
    );

    expect(result.events.map((e) => e.recordedAt)).toEqual([
      "2026-07-19T15:00:00Z",
      "2026-07-19T15:05:00Z",
      "2026-07-19T15:10:00Z",
    ]);
  });

  it("filters by userId when given", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendEvent(FAMILY_ID, eventLine({ eventId: "e1", userId: "u2" }));
    await deps.historyStore.appendEvent(FAMILY_ID, eventLine({ eventId: "e2", userId: "u3" }));

    const result = await getGeofenceEventHistory(
      { familyId: FAMILY_ID, query: { from: "2026-07-19", to: "2026-07-19", userId: "u2" } },
      deps,
    );

    expect(result.events.map((e) => e.userId)).toEqual(["u2"]);
  });

  it("returns an empty result (not an error) for an unknown userId filter", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendEvent(FAMILY_ID, eventLine());

    const result = await getGeofenceEventHistory(
      { familyId: FAMILY_ID, query: { from: "2026-07-19", to: "2026-07-19", userId: "someone-unknown" } },
      deps,
    );

    expect(result.events).toEqual([]);
  });

  it("preserves null geofenceName/lat/lon/radiusM for events with an unknown geofenceId at write time", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendEvent(
      FAMILY_ID,
      eventLine({ geofenceId: "gf_deleted", geofenceName: null, lat: null, lon: null, radiusM: null }),
    );

    const result = await getGeofenceEventHistory(
      { familyId: FAMILY_ID, query: { from: "2026-07-19", to: "2026-07-19" } },
      deps,
    );

    expect(result.events[0]).toMatchObject({
      geofenceName: null,
      lat: null,
      lon: null,
      radiusM: null,
    });
  });

  it("event shape drops eventId (not part of the 001 §7.4 wire shape)", async () => {
    const deps = buildDeps();
    await deps.historyStore.appendEvent(FAMILY_ID, eventLine());

    const result = await getGeofenceEventHistory(
      { familyId: FAMILY_ID, query: { from: "2026-07-19", to: "2026-07-19" } },
      deps,
    );

    expect(result.events[0]).toEqual({
      userId: "u2",
      deviceId: "device-1",
      geofenceId: "gf_home",
      geofenceName: "Home",
      lat: 51.0543,
      lon: 3.7174,
      radiusM: 150,
      transition: "enter",
      recordedAt: "2026-07-19T15:03:22Z",
      receivedAt: "2026-07-19T15:03:24Z",
    });
    expect("eventId" in result.events[0]!).toBe(false);
  });

  it("cursor round-trip: a small limit page followed by the returned cursor yields the rest, no dup/skip", async () => {
    const deps = buildDeps();
    for (let i = 0; i < 5; i++) {
      await deps.historyStore.appendEvent(
        FAMILY_ID,
        eventLine({ eventId: `e${i}`, recordedAt: `2026-07-19T15:0${i}:00Z` }),
      );
    }

    const page1 = await getGeofenceEventHistory(
      { familyId: FAMILY_ID, query: { from: "2026-07-19", to: "2026-07-19", limit: 2 } },
      deps,
    );
    expect(page1.events).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await getGeofenceEventHistory(
      {
        familyId: FAMILY_ID,
        query: { from: "2026-07-19", to: "2026-07-19", limit: 2, cursor: page1.nextCursor },
      },
      deps,
    );
    expect(page2.events).toHaveLength(2);

    const page3 = await getGeofenceEventHistory(
      {
        familyId: FAMILY_ID,
        query: { from: "2026-07-19", to: "2026-07-19", limit: 2, cursor: page2.nextCursor },
      },
      deps,
    );
    expect(page3.events).toHaveLength(1);
    expect(page3.nextCursor).toBeNull();

    const allTimes = [...page1.events, ...page2.events, ...page3.events].map((e) => e.recordedAt);
    expect(allTimes).toEqual([
      "2026-07-19T15:00:00Z",
      "2026-07-19T15:01:00Z",
      "2026-07-19T15:02:00Z",
      "2026-07-19T15:03:00Z",
      "2026-07-19T15:04:00Z",
    ]);
  });

  it("returns features derived from PLAN_MATRIX.free", async () => {
    const deps = buildDeps();

    const result = await getGeofenceEventHistory(
      { familyId: FAMILY_ID, query: { from: "2026-07-19", to: "2026-07-19" } },
      deps,
    );

    expect(result.features).toEqual(getFeatures("free"));
  });
});
