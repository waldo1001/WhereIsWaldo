// specs/002 §2.9/§6 — Usage guarded-update race: increment() must not lose updates under
// ETag contention (read -> +n -> guarded merge, retry loop). Requires Azurite
// (`npm run dev:storage`); run via `npm run test:integration`.
//
// Note: 002 §2.9 caps the retry loop at 3 attempts and then deliberately "logs and drops"
// (usage is telemetry, not billing) — under pathological contention (many more than 3
// simultaneous racers on one row) a rare drop is spec-accepted behavior, not a bug. This
// suite uses a moderate concurrency that stays within the retry budget so the race is
// exercised without asserting a guarantee the adapter doesn't make.

import { beforeAll, describe, expect, it } from "vitest";
import { ensureTables } from "./support/ensureStorage";
import { testFamilyId } from "./support/ids";
import { TableUsageRepo } from "../../src/adapters/tables/usageTableRepo";

describe("integration/Usage — guarded-update race (specs/002 §2.9/§6)", () => {
  beforeAll(async () => {
    await ensureTables("Usage");
  }, 30_000);

  it("increments from zero on a brand-new (familyId, metric, date) row", async () => {
    const repo = new TableUsageRepo();
    const familyId = testFamilyId();

    await repo.increment(familyId, "apiCalls", "2026-07-19");

    expect(await repo.get(familyId, "apiCalls", "2026-07-19")).toBe(1);
  });

  it("increment(by) adds the given count, not always 1", async () => {
    const repo = new TableUsageRepo();
    const familyId = testFamilyId();

    await repo.increment(familyId, "fixes", "2026-07-19", 7);

    expect(await repo.get(familyId, "fixes", "2026-07-19")).toBe(7);
  });

  it("sequential increments accumulate correctly (guarded merge reads current, not a cached value)", async () => {
    const repo = new TableUsageRepo();
    const familyId = testFamilyId();

    await repo.increment(familyId, "locationBatches", "2026-07-19");
    await repo.increment(familyId, "locationBatches", "2026-07-19");
    await repo.increment(familyId, "locationBatches", "2026-07-19");

    expect(await repo.get(familyId, "locationBatches", "2026-07-19")).toBe(3);
  });

  it("concurrent increments to the same brand-new row all land (no lost updates under the ETag race)", async () => {
    const familyId = testFamilyId();
    const CONCURRENCY = 3; // within the adapter's 3-attempt retry budget (002 §2.9)

    await Promise.all(
      Array.from({ length: CONCURRENCY }, () => new TableUsageRepo().increment(familyId, "apiCalls", "2026-07-19")),
    );

    const repo = new TableUsageRepo();
    expect(await repo.get(familyId, "apiCalls", "2026-07-19")).toBe(CONCURRENCY);
  });

  it("concurrent increments to an already-existing row all land", async () => {
    const familyId = testFamilyId();
    await new TableUsageRepo().increment(familyId, "geofenceEvents", "2026-07-19", 10);

    await Promise.all(
      Array.from({ length: 3 }, () => new TableUsageRepo().increment(familyId, "geofenceEvents", "2026-07-19")),
    );

    const repo = new TableUsageRepo();
    expect(await repo.get(familyId, "geofenceEvents", "2026-07-19")).toBe(13);
  });

  it("returns 0 for a metric/date that was never incremented", async () => {
    const repo = new TableUsageRepo();
    const familyId = testFamilyId();

    expect(await repo.get(familyId, "locateRequests", "2026-07-19")).toBe(0);
  });
});
