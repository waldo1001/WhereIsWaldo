// specs/002 §2.5/§6 — LastKnown guarded-update race: upsertIfNewer must overwrite only if
// the incoming recordedAt is strictly newer than the stored one, with a retry on ETag
// contention (002 §2.5). Requires Azurite (`npm run dev:storage`); run via
// `npm run test:integration`.

import { beforeAll, describe, expect, it } from "vitest";
import { ensureTables } from "./support/ensureStorage";
import { testFamilyId } from "./support/ids";
import { TableLastKnownRepo } from "../../src/adapters/tables/lastKnownTableRepo";
import type { LastKnownRecord } from "../../src/ports/repositories";

function record(overrides: Partial<LastKnownRecord> = {}): LastKnownRecord {
  return {
    deviceId: "device-1",
    lat: 51.0543,
    lon: 3.7174,
    accuracyM: 12.5,
    batteryPct: 78,
    recordedAt: "2026-07-19T09:00:00Z",
    receivedAt: "2026-07-19T09:00:02Z",
    source: "periodic",
    ...overrides,
  };
}

describe("integration/LastKnown — guarded-update race (specs/002 §2.5/§6)", () => {
  beforeAll(async () => {
    await ensureTables("LastKnown");
  }, 30_000);

  it("writes the first report for a device (no existing row)", async () => {
    const repo = new TableLastKnownRepo();
    const familyId = testFamilyId();

    const wrote = await repo.upsertIfNewer(familyId, record());

    expect(wrote).toBe(true);
    const stored = await repo.get(familyId, "device-1");
    expect(stored?.recordedAt).toBe("2026-07-19T09:00:00Z");
  });

  it("does not overwrite when the incoming recordedAt is older than the stored one", async () => {
    const repo = new TableLastKnownRepo();
    const familyId = testFamilyId();
    await repo.upsertIfNewer(familyId, record({ recordedAt: "2026-07-19T09:10:00Z", lat: 52.0 }));

    const wrote = await repo.upsertIfNewer(familyId, record({ recordedAt: "2026-07-19T09:00:00Z", lat: 1.0 }));

    expect(wrote).toBe(false);
    const stored = await repo.get(familyId, "device-1");
    expect(stored?.lat).toBe(52.0); // unchanged
  });

  it("overwrites when the incoming recordedAt is newer than the stored one", async () => {
    const repo = new TableLastKnownRepo();
    const familyId = testFamilyId();
    await repo.upsertIfNewer(familyId, record({ recordedAt: "2026-07-19T09:00:00Z", lat: 1.0 }));

    const wrote = await repo.upsertIfNewer(familyId, record({ recordedAt: "2026-07-19T09:10:00Z", lat: 52.0 }));

    expect(wrote).toBe(true);
    const stored = await repo.get(familyId, "device-1");
    expect(stored?.lat).toBe(52.0);
  });

  it("under concurrent racing writers to a brand-new device row, the newest recordedAt always wins", async () => {
    const familyId = testFamilyId();
    // Two independent repo instances (separate TableClients) racing on the same brand-new
    // row — one createEntity call wins, the other gets a 409 and must retry (002 §2.5).
    const repoA = new TableLastKnownRepo();
    const repoB = new TableLastKnownRepo();

    const [wroteA, wroteB] = await Promise.all([
      repoA.upsertIfNewer(familyId, record({ recordedAt: "2026-07-19T09:00:00Z", lat: 10 })),
      repoB.upsertIfNewer(familyId, record({ recordedAt: "2026-07-19T09:05:00Z", lat: 20 })),
    ]);

    // Both calls must complete without throwing (races are handled internally); the
    // NEWER recordedAt must be the one actually persisted regardless of arrival order.
    expect(wroteA || wroteB).toBe(true);
    const stored = await repoA.get(familyId, "device-1");
    expect(stored?.recordedAt).toBe("2026-07-19T09:05:00Z");
    expect(stored?.lat).toBe(20);
  });

  it("under concurrent racing writers to an existing row, the newest recordedAt always wins", async () => {
    const familyId = testFamilyId();
    await new TableLastKnownRepo().upsertIfNewer(familyId, record({ recordedAt: "2026-07-19T08:00:00Z", lat: 0 }));

    const repoA = new TableLastKnownRepo();
    const repoB = new TableLastKnownRepo();
    await Promise.all([
      repoA.upsertIfNewer(familyId, record({ recordedAt: "2026-07-19T09:00:00Z", lat: 10 })),
      repoB.upsertIfNewer(familyId, record({ recordedAt: "2026-07-19T09:05:00Z", lat: 20 })),
    ]);

    const stored = await repoA.get(familyId, "device-1");
    expect(stored?.recordedAt).toBe("2026-07-19T09:05:00Z");
    expect(stored?.lat).toBe(20);
  });
});
