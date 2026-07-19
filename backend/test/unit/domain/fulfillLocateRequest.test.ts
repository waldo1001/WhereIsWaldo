import { describe, expect, it } from "vitest";
import { fulfillLocateRequest, toStoredFix } from "../../../src/domain/locate/fulfillLocateRequest";
import { getFeatures } from "../../../src/domain/plan";
import { InMemoryLocateRequestRepo } from "../../fakes/inMemoryLocateRequestRepo";
import { InMemoryLastKnownRepo } from "../../fakes/inMemoryLastKnownRepo";
import { InMemoryHistoryStore } from "../../fakes/inMemoryHistoryStore";
import { InMemoryIdempotencyRepo } from "../../fakes/inMemoryIdempotencyRepo";
import { InMemoryUsageRepo } from "../../fakes/inMemoryUsageRepo";
import { InMemoryEntitlementsRepo } from "../../fakes/inMemoryEntitlementsRepo";
import { FixedClock } from "../../fakes/fixedClock";
import { expectAppError } from "../../support/expectAppError";
import type { LocateRequestRecord } from "../../../src/ports/repositories";

const FAMILY_ID = "fam_9J2Kq7Lm3NpR5sTvWxYz";
const TARGET_UID = "u2";
const TARGET_DEVICE_ID = "3e0f2a9c-6b1d-4e8f-9a2b-7c5d4e3f2a1b";
const OTHER_DEVICE_ID = "4f1a3b0d-7c2e-5f9a-ab3c-8d6e5f4a3b2c";
const REQUEST_ID = "lr_00000000000000000001";
const NOW = "2026-07-19T09:10:00Z";

function buildDeps() {
  const entitlementsRepo = new InMemoryEntitlementsRepo();
  entitlementsRepo.seed(FAMILY_ID, { subscriptionStatus: "free", updatedAt: "2026-07-01T00:00:00Z" });
  return {
    locateRequestRepo: new InMemoryLocateRequestRepo(),
    lastKnownRepo: new InMemoryLastKnownRepo(),
    historyStore: new InMemoryHistoryStore(),
    idempotencyRepo: new InMemoryIdempotencyRepo(),
    usageRepo: new InMemoryUsageRepo(),
    entitlementsRepo,
    clock: new FixedClock(new Date(NOW)),
  };
}

function record(overrides: Partial<LocateRequestRecord> = {}): LocateRequestRecord {
  return {
    requestId: REQUEST_ID,
    familyId: FAMILY_ID,
    targetUserId: TARGET_UID,
    targetDeviceId: TARGET_DEVICE_ID,
    requestedBy: "u1",
    status: "pending",
    createdAt: "2026-07-19T09:09:00Z",
    expiresAt: "2026-07-19T09:10:00Z",
    ...overrides,
  };
}

function fix(overrides: Record<string, unknown> = {}) {
  return {
    fixId: "a1e2b3c4-0000-4000-8000-000000000001",
    recordedAt: "2026-07-19T09:09:30Z",
    lat: 51.0544,
    lon: 3.717,
    accuracyM: 4.8,
    batteryPct: 77,
    source: "locate",
    ...overrides,
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    familyId: FAMILY_ID as string | null,
    deviceId: TARGET_DEVICE_ID as string | null,
    requestId: REQUEST_ID,
    body: { fix: fix() },
    ...overrides,
  };
}

describe("domain/locate/toStoredFix", () => {
  it("omits absent optional fields as missing keys, not undefined-valued ones", () => {
    const result = toStoredFix(fix() as Parameters<typeof toStoredFix>[0]);

    expect("altitudeM" in result).toBe(false);
    expect("speedMps" in result).toBe(false);
    expect("bearingDeg" in result).toBe(false);
    expect(result.fixId).toBe("a1e2b3c4-0000-4000-8000-000000000001");
    expect(result.source).toBe("locate");
  });

  it("includes optional fields with their actual values when present", () => {
    const result = toStoredFix(
      fix({ altitudeM: 8.0, speedMps: 1.5, bearingDeg: 90 }) as Parameters<typeof toStoredFix>[0],
    );

    expect(result.altitudeM).toBe(8.0);
    expect(result.speedMps).toBe(1.5);
    expect(result.bearingDeg).toBe(90);
  });
});

describe("domain/locate/fulfillLocateRequest", () => {
  it("throws FAMILY_NOT_FOUND when the caller has no family", async () => {
    const deps = buildDeps();
    await expectAppError(fulfillLocateRequest(baseInput({ familyId: null }), deps), "FAMILY_NOT_FOUND");
  });

  it("throws INTERNAL_ERROR when the family has no Entitlements record", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ expiresAt: "2026-07-19T09:11:00Z" }));
    const entitlementsRepo = new InMemoryEntitlementsRepo();
    await expectAppError(fulfillLocateRequest(baseInput(), { ...deps, entitlementsRepo }), "INTERNAL_ERROR");
  });

  it("throws LOCATE_REQUEST_NOT_FOUND for an unknown requestId", async () => {
    const deps = buildDeps();
    await expectAppError(fulfillLocateRequest(baseInput(), deps), "LOCATE_REQUEST_NOT_FOUND");
  });

  it("throws AUTH_FORBIDDEN when X-Device-Id does not match the request's targetDeviceId", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ expiresAt: "2026-07-19T09:11:00Z" }));
    await expectAppError(
      fulfillLocateRequest(baseInput({ deviceId: OTHER_DEVICE_ID }), deps),
      "AUTH_FORBIDDEN",
    );
  });

  it("throws AUTH_FORBIDDEN when X-Device-Id header is missing", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ expiresAt: "2026-07-19T09:11:00Z" }));
    await expectAppError(fulfillLocateRequest(baseInput({ deviceId: null }), deps), "AUTH_FORBIDDEN");
  });

  it("throws VALIDATION_FAILED when fix.source is not 'locate'", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ expiresAt: "2026-07-19T09:11:00Z" }));
    await expectAppError(
      fulfillLocateRequest(baseInput({ body: { fix: fix({ source: "periodic" }) } }), deps),
      "VALIDATION_FAILED",
    );
  });

  it("within the window: marks the request fulfilled and returns status fulfilled", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ expiresAt: "2026-07-19T09:11:00Z" }));

    const result = await fulfillLocateRequest(baseInput(), deps);

    expect(result.status).toBe("fulfilled");
    expect(result.features).toEqual(getFeatures("free"));
    const stored = await deps.locateRequestRepo.get(FAMILY_ID, REQUEST_ID);
    expect(stored?.status).toBe("fulfilled");
  });

  it("updates last-known and appends history exactly like a §5.1 report", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ expiresAt: "2026-07-19T09:11:00Z" }));

    await fulfillLocateRequest(baseInput(), deps);

    const stored = await deps.lastKnownRepo.get(FAMILY_ID, TARGET_DEVICE_ID);
    expect(stored?.lat).toBe(51.0544);
    expect(stored?.lon).toBe(3.717);
    expect(stored?.accuracyM).toBe(4.8);
    expect(stored?.batteryPct).toBe(77);
    expect(stored?.source).toBe("locate");
    expect(stored?.recordedAt).toBe("2026-07-19T09:09:30Z");
    // Omitted (not null) when absent from the submitted fix — same rule as §5.1.
    expect("altitudeM" in (stored as object)).toBe(false);
    expect("speedMps" in (stored as object)).toBe(false);
    expect("bearingDeg" in (stored as object)).toBe(false);

    expect(deps.historyStore.fixes.length).toBe(1);
    const appended = deps.historyStore.fixes[0]!;
    expect(appended.familyId).toBe(FAMILY_ID);
    expect(appended.userId).toBe(TARGET_UID);
    expect(appended.deviceId).toBe(TARGET_DEVICE_ID);
    expect(appended.fix.fixId).toBe("a1e2b3c4-0000-4000-8000-000000000001");
    expect(appended.fix.lat).toBe(51.0544);
    expect(appended.fix.lon).toBe(3.717);
    expect(appended.fix.accuracyM).toBe(4.8);
    expect(appended.fix.batteryPct).toBe(77);
    expect(appended.fix.source).toBe("locate");
    expect("altitudeM" in appended.fix).toBe(false);
    expect("speedMps" in appended.fix).toBe(false);
    expect("bearingDeg" in appended.fix).toBe(false);

    const requestRecord = await deps.locateRequestRepo.get(FAMILY_ID, REQUEST_ID);
    const storedFix = JSON.parse(requestRecord!.fixJson!) as Record<string, unknown>;
    expect(storedFix.fixId).toBe("a1e2b3c4-0000-4000-8000-000000000001");
    expect(storedFix.lat).toBe(51.0544);
    expect(storedFix.lon).toBe(3.717);
    expect(storedFix.accuracyM).toBe(4.8);
    expect(storedFix.batteryPct).toBe(77);
    expect(storedFix.source).toBe("locate");
    expect("altitudeM" in storedFix).toBe(false);
    expect("speedMps" in storedFix).toBe(false);
    expect("bearingDeg" in storedFix).toBe(false);
  });

  it("does not overwrite last-known with an older fix (only-newer rule)", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ expiresAt: "2026-07-19T09:11:00Z" }));
    deps.lastKnownRepo.seed(FAMILY_ID, {
      deviceId: TARGET_DEVICE_ID,
      lat: 10,
      lon: 20,
      accuracyM: 5,
      batteryPct: 90,
      recordedAt: "2026-07-19T09:09:59Z", // newer than the fulfill fix's 09:09:30
      receivedAt: "2026-07-19T09:09:59Z",
      source: "periodic",
    });

    await fulfillLocateRequest(baseInput(), deps);

    const stored = await deps.lastKnownRepo.get(FAMILY_ID, TARGET_DEVICE_ID);
    expect(stored?.lat).toBe(10);
  });

  it("carries optional altitudeM/speedMps/bearingDeg through to last-known, history, and the stored fix when present", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ expiresAt: "2026-07-19T09:11:00Z" }));

    await fulfillLocateRequest(
      baseInput({ body: { fix: fix({ altitudeM: 8.0, speedMps: 1.5, bearingDeg: 90 }) } }),
      deps,
    );

    const stored = await deps.lastKnownRepo.get(FAMILY_ID, TARGET_DEVICE_ID);
    expect(stored?.altitudeM).toBe(8.0);
    expect(stored?.speedMps).toBe(1.5);
    expect(stored?.bearingDeg).toBe(90);

    const appended = deps.historyStore.fixes[0]!;
    expect(appended.fix.altitudeM).toBe(8.0);
    expect(appended.fix.speedMps).toBe(1.5);
    expect(appended.fix.bearingDeg).toBe(90);

    const requestRecord = await deps.locateRequestRepo.get(FAMILY_ID, REQUEST_ID);
    const storedFix = JSON.parse(requestRecord!.fixJson!) as Record<string, unknown>;
    expect(storedFix.altitudeM).toBe(8.0);
    expect(storedFix.speedMps).toBe(1.5);
    expect(storedFix.bearingDeg).toBe(90);
  });

  it("does not downgrade an already-fulfilled request's status when a later expired-window fulfill attempt arrives", async () => {
    const deps = buildDeps();
    const priorFixJson = JSON.stringify({ ...fix({ fixId: "a1e2b3c4-0000-4000-8000-000000000099" }) });
    deps.locateRequestRepo.seed(
      record({ status: "fulfilled", expiresAt: "2026-07-19T09:09:00Z", fixJson: priorFixJson }),
    );

    await expectAppError(
      fulfillLocateRequest(baseInput({ body: { fix: fix({ fixId: "a1e2b3c4-0000-4000-8000-000000000002" }) } }), deps),
      "LOCATE_REQUEST_EXPIRED",
    );

    const requestRecord = await deps.locateRequestRepo.get(FAMILY_ID, REQUEST_ID);
    expect(requestRecord?.status).toBe("fulfilled"); // must NOT be clobbered to "expired"
  });

  it("increments fixes and apiCalls usage on an accepted fulfill", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ expiresAt: "2026-07-19T09:11:00Z" }));

    await fulfillLocateRequest(baseInput(), deps);

    expect(await deps.usageRepo.get(FAMILY_ID, "fixes", "2026-07-19")).toBe(1);
    expect(await deps.usageRepo.get(FAMILY_ID, "apiCalls", "2026-07-19")).toBe(1);
  });

  it("is idempotent on fixId: a replay does not double-write last-known/history/fixes usage", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ expiresAt: "2026-07-19T09:11:00Z" }));

    await fulfillLocateRequest(baseInput(), deps);
    const result = await fulfillLocateRequest(baseInput(), deps);

    expect(result.status).toBe("fulfilled");
    expect(deps.historyStore.fixes.length).toBe(1);
    expect(await deps.usageRepo.get(FAMILY_ID, "fixes", "2026-07-19")).toBe(1);
    // apiCalls still counts every authenticated call, including replays.
    expect(await deps.usageRepo.get(FAMILY_ID, "apiCalls", "2026-07-19")).toBe(2);
  });

  it("past expiresAt: throws LOCATE_REQUEST_EXPIRED but still stores last-known + history", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ status: "pending", expiresAt: "2026-07-19T09:09:59Z" }));

    await expectAppError(fulfillLocateRequest(baseInput(), deps), "LOCATE_REQUEST_EXPIRED");

    const stored = await deps.lastKnownRepo.get(FAMILY_ID, TARGET_DEVICE_ID);
    expect(stored?.lat).toBe(51.0544);
    expect(deps.historyStore.fixes.length).toBe(1);

    const requestRecord = await deps.locateRequestRepo.get(FAMILY_ID, REQUEST_ID);
    expect(requestRecord?.status).toBe("expired");
  });

  it("does not flip to expired exactly at expiresAt (boundary: only strictly past expires)", async () => {
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ status: "pending", expiresAt: NOW }));

    const result = await fulfillLocateRequest(baseInput(), deps);

    expect(result.status).toBe("fulfilled");
  });

  it("a paused target device MAY still fulfill (TRACKING_PAUSED does not apply here)", async () => {
    // No DeviceRepo dependency at all — pause state is irrelevant to fulfill (§6.3).
    const deps = buildDeps();
    deps.locateRequestRepo.seed(record({ expiresAt: "2026-07-19T09:11:00Z" }));

    const result = await fulfillLocateRequest(baseInput(), deps);

    expect(result.status).toBe("fulfilled");
  });
});
