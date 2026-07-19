// specs/001 §6.3 — fulfill locate request. Pure domain logic: no Azure/Google imports.
// Called by the TARGET device; TRACKING_PAUSED intentionally never applies here (§6.3),
// so this use-case has no DeviceRepo dependency at all — authorization is a plain
// X-Device-Id === targetDeviceId comparison against the stored request.

import { AppError } from "../../http/errors";
import { fulfillLocateRequestRequestSchema, parseOrThrow, type LocationFixRequest } from "../../http/validate";
import type { Clock } from "../../ports/support";
import type {
  EntitlementsRepo,
  IdempotencyRepo,
  LastKnownRecord,
  LastKnownRepo,
  LocateRequestRepo,
  UsageRepo,
} from "../../ports/repositories";
import type { FixLine, HistoryStore } from "../../ports/historyStore";
import { getFeatures, type Features } from "../plan";

export interface FulfillLocateRequestDeps {
  locateRequestRepo: LocateRequestRepo;
  lastKnownRepo: LastKnownRepo;
  historyStore: HistoryStore;
  idempotencyRepo: IdempotencyRepo;
  usageRepo: UsageRepo;
  entitlementsRepo: EntitlementsRepo;
  clock: Clock;
}

export interface FulfillLocateRequestInput {
  /** The X-Device-Id header (§1.2), null if absent. */
  deviceId: string | null;
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
  requestId: string;
  body: unknown;
}

export interface FulfillLocateRequestResult {
  status: "fulfilled";
  features: Features;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function buildFixLine(fix: LocationFixRequest, receivedAt: string): FixLine {
  return {
    fixId: fix.fixId,
    recordedAt: fix.recordedAt,
    receivedAt,
    lat: fix.lat,
    lon: fix.lon,
    accuracyM: fix.accuracyM,
    ...(fix.altitudeM !== undefined ? { altitudeM: fix.altitudeM } : {}),
    ...(fix.speedMps !== undefined ? { speedMps: fix.speedMps } : {}),
    ...(fix.bearingDeg !== undefined ? { bearingDeg: fix.bearingDeg } : {}),
    batteryPct: fix.batteryPct,
    source: fix.source,
  };
}

export async function fulfillLocateRequest(
  input: FulfillLocateRequestInput,
  deps: FulfillLocateRequestDeps,
): Promise<FulfillLocateRequestResult> {
  if (!input.familyId) {
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  const familyId = input.familyId;

  const entitlements = await deps.entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  const features = getFeatures(entitlements.subscriptionStatus);

  const record = await deps.locateRequestRepo.get(familyId, input.requestId);
  if (!record) {
    throw new AppError("LOCATE_REQUEST_NOT_FOUND", "unknown requestId");
  }

  if (input.deviceId !== record.targetDeviceId) {
    throw new AppError("AUTH_FORBIDDEN", "X-Device-Id does not match the locate request's target device");
  }

  const body = parseOrThrow(fulfillLocateRequestRequestSchema, input.body);

  const now = deps.clock.now();
  const receivedAt = now.toISOString();
  const date = usageDate(now);
  const isExpired = now.getTime() > new Date(record.expiresAt).getTime();

  const inserted = await deps.idempotencyRepo.tryInsertFixMarker(record.targetDeviceId, body.fix.fixId, receivedAt);
  if (inserted) {
    const lastKnownCandidate: LastKnownRecord = {
      deviceId: record.targetDeviceId,
      lat: body.fix.lat,
      lon: body.fix.lon,
      accuracyM: body.fix.accuracyM,
      ...(body.fix.altitudeM !== undefined ? { altitudeM: body.fix.altitudeM } : {}),
      ...(body.fix.speedMps !== undefined ? { speedMps: body.fix.speedMps } : {}),
      ...(body.fix.bearingDeg !== undefined ? { bearingDeg: body.fix.bearingDeg } : {}),
      batteryPct: body.fix.batteryPct,
      recordedAt: body.fix.recordedAt,
      receivedAt,
      source: body.fix.source,
    };
    await deps.lastKnownRepo.upsertIfNewer(familyId, lastKnownCandidate);
    await deps.historyStore.appendFix(
      familyId,
      record.targetUserId,
      record.targetDeviceId,
      buildFixLine(body.fix, receivedAt),
    );
    await deps.usageRepo.increment(familyId, "fixes", date);
  }

  await deps.usageRepo.increment(familyId, "apiCalls", date);

  if (isExpired) {
    if (record.status === "pending") {
      await deps.locateRequestRepo.update(familyId, record.requestId, { status: "expired" });
    }
    throw new AppError("LOCATE_REQUEST_EXPIRED", "locate request expired before it was fulfilled");
  }

  const fixJson = JSON.stringify(toStoredFix(body.fix));
  await deps.locateRequestRepo.update(familyId, record.requestId, { status: "fulfilled", fixJson });

  return { status: "fulfilled", features };
}

/**
 * Builds the plain object later JSON.stringify'd into LocateRequestRecord.fixJson (§6.2's
 * poll-response fix). Exported so unit tests can assert key-presence on the raw object
 * directly — JSON.stringify silently drops `undefined`-valued keys, which would otherwise
 * make a mutant that always includes an absent optional key (as `undefined`) look
 * equivalent once serialized, even though the pre-serialization shape did change.
 */
export function toStoredFix(fix: LocationFixRequest): Record<string, unknown> {
  return {
    fixId: fix.fixId,
    recordedAt: fix.recordedAt,
    lat: fix.lat,
    lon: fix.lon,
    accuracyM: fix.accuracyM,
    ...(fix.altitudeM !== undefined ? { altitudeM: fix.altitudeM } : {}),
    ...(fix.speedMps !== undefined ? { speedMps: fix.speedMps } : {}),
    ...(fix.bearingDeg !== undefined ? { bearingDeg: fix.bearingDeg } : {}),
    batteryPct: fix.batteryPct,
    source: fix.source,
  };
}
