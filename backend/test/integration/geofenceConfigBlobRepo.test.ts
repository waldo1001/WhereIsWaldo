// specs/002 §3.1/§3.4/§6 — BlobGeofenceConfigRepo against real Azurite: the "0" sentinel
// first-write (If-None-Match: *), a normal If-Match update, and the storage 412 -> domain
// 409 GEOFENCE_VERSION_CONFLICT mapping (stale-ETag flow). Requires Azurite
// (`npm run dev:storage`); run via `npm run test:integration`.

import { beforeAll, describe, expect, it } from "vitest";
import { ensureContainers } from "./support/ensureStorage";
import { testFamilyId } from "./support/ids";
import { BlobGeofenceConfigRepo } from "../../src/adapters/blobs/geofenceConfigBlobRepo";
import type { GeofenceConfigDocument } from "../../src/ports/geofenceConfig";

function config(overrides: Partial<GeofenceConfigDocument> = {}): GeofenceConfigDocument {
  return {
    version: 1,
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
    ...overrides,
  };
}

describe("integration/BlobGeofenceConfigRepo — config container (specs/002 §3.1/§3.4/§6)", () => {
  beforeAll(async () => {
    await ensureContainers("config");
  }, 30_000);

  it("a never-written family reads back {version:0, geofences:[]} with etag \"0\"", async () => {
    const repo = new BlobGeofenceConfigRepo();
    const familyId = testFamilyId();

    const result = await repo.get(familyId);

    expect(result.config).toEqual({ version: 0, geofences: [] });
    expect(result.etag).toBe("0");
    expect(await repo.getEtag(familyId)).toBe("0");
  });

  it("\"0\" sentinel creates the first document (If-None-Match: *), returning a fresh (non-\"0\") ETag", async () => {
    const repo = new BlobGeofenceConfigRepo();
    const familyId = testFamilyId();

    const outcome = await repo.replace(familyId, config({ version: 1 }), "0");

    expect(outcome.outcome).toBe("ok");
    if (outcome.outcome !== "ok") throw new Error("unreachable");
    expect(outcome.etag).not.toBe("0");

    const read = await repo.get(familyId);
    expect(read.config).toEqual(config({ version: 1 }));
    expect(read.etag).toBe(outcome.etag);
  });

  it("\"0\" sentinel conflicts (412 -> conflict) when a document already exists", async () => {
    const repo = new BlobGeofenceConfigRepo();
    const familyId = testFamilyId();
    const first = await repo.replace(familyId, config({ version: 1 }), "0");
    if (first.outcome !== "ok") throw new Error("setup failed");

    const outcome = await repo.replace(familyId, config({ version: 1 }), "0");

    expect(outcome.outcome).toBe("conflict");
    if (outcome.outcome !== "conflict") throw new Error("unreachable");
    expect(outcome.currentEtag).toBe(first.etag);
  });

  it("a matching If-Match updates the document and returns a new ETag", async () => {
    const repo = new BlobGeofenceConfigRepo();
    const familyId = testFamilyId();
    const created = await repo.replace(familyId, config({ version: 1 }), "0");
    if (created.outcome !== "ok") throw new Error("setup failed");

    const updated = await repo.replace(
      familyId,
      config({ version: 2, geofences: [{ ...config().geofences[0]!, name: "Home 2" }] }),
      created.etag,
    );

    expect(updated.outcome).toBe("ok");
    if (updated.outcome !== "ok") throw new Error("unreachable");
    expect(updated.etag).not.toBe(created.etag);

    const read = await repo.get(familyId);
    expect(read.config.version).toBe(2);
    expect(read.config.geofences[0]?.name).toBe("Home 2");
    expect(read.etag).toBe(updated.etag);
  });

  it("a stale If-Match maps storage's 412 to a conflict outcome carrying the ACTUAL current ETag", async () => {
    const repo = new BlobGeofenceConfigRepo();
    const familyId = testFamilyId();
    const created = await repo.replace(familyId, config({ version: 1 }), "0");
    if (created.outcome !== "ok") throw new Error("setup failed");

    // A second writer updates first (simulating a race), advancing the real current ETag...
    const secondWriter = await repo.replace(familyId, config({ version: 2 }), created.etag);
    if (secondWriter.outcome !== "ok") throw new Error("setup failed");

    // ...then our original (now-stale) ETag is rejected, and the conflict reports the LATEST
    // ETag (the second writer's), not our stale snapshot.
    const stale = await repo.replace(familyId, config({ version: 2 }), created.etag);

    expect(stale.outcome).toBe("conflict");
    if (stale.outcome !== "conflict") throw new Error("unreachable");
    expect(stale.currentEtag).toBe(secondWriter.etag);
    expect(stale.currentEtag).not.toBe(created.etag);
  });
});
