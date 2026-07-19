// specs/001 §5.1 — report locations (batch). Pure domain logic: no Azure/Google imports.

import { AppError } from "../../http/errors";
import { parseOrThrow, reportLocationsRequestSchema, type LocationFixRequest } from "../../http/validate";
import type { Clock } from "../../ports/support";
import type {
  DeviceRepo,
  EntitlementsRepo,
  IdempotencyRepo,
  LastKnownRecord,
  LastKnownRepo,
  UsageRepo,
} from "../../ports/repositories";
import type { FixLine, HistoryStore } from "../../ports/historyStore";
import type { GeofenceConfigRepo } from "../../ports/geofenceConfig";
import { getFeatures, type Features } from "../plan";

const MAX_BATCH_SIZE = 100;
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export interface ReportLocationsDeps {
  deviceRepo: DeviceRepo;
  lastKnownRepo: LastKnownRepo;
  idempotencyRepo: IdempotencyRepo;
  historyStore: HistoryStore;
  usageRepo: UsageRepo;
  geofenceConfigRepo: GeofenceConfigRepo;
  entitlementsRepo: EntitlementsRepo;
  clock: Clock;
}

export interface ReportLocationsInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
  /** The X-Device-Id header (§1.2), null if absent. */
  deviceId: string | null;
  body: unknown;
}

export interface DeviceSettingsSnapshot {
  syncIntervalMinutes: number;
  trackingEnabled: boolean;
}

export interface ReportLocationsResult {
  accepted: number;
  duplicates: number;
  lastKnownUpdated: boolean;
  deviceSettings: DeviceSettingsSnapshot;
  geofenceEtag: string;
  features: Features;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function fixesRawArray(body: unknown): unknown[] | null {
  if (typeof body !== "object" || body === null) return null;
  const fixes = (body as Record<string, unknown>).fixes;
  return Array.isArray(fixes) ? fixes : null;
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

function newestFix(fixes: LocationFixRequest[]): LocationFixRequest {
  return fixes.reduce((newest, current) =>
    new Date(current.recordedAt).getTime() > new Date(newest.recordedAt).getTime() ? current : newest,
  );
}

export async function reportLocations(
  input: ReportLocationsInput,
  deps: ReportLocationsDeps,
): Promise<ReportLocationsResult> {
  if (!input.familyId) {
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  const familyId = input.familyId;

  const entitlements = await deps.entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  const features = getFeatures(entitlements.subscriptionStatus);

  if (!input.deviceId) {
    throw new AppError("DEVICE_NOT_FOUND", "X-Device-Id header is required");
  }
  const deviceId = input.deviceId;

  const device = await deps.deviceRepo.getDevice(familyId, deviceId);
  if (!device || device.ownerUserId !== input.uid) {
    throw new AppError("DEVICE_NOT_FOUND", "X-Device-Id is not registered to the calling user");
  }

  const deviceSettings: DeviceSettingsSnapshot = {
    syncIntervalMinutes: device.syncIntervalMinutes,
    trackingEnabled: device.trackingEnabled,
  };

  if (!device.trackingEnabled) {
    throw new AppError("TRACKING_PAUSED", "device tracking is paused", { deviceSettings });
  }

  const rawFixes = fixesRawArray(input.body);
  if (rawFixes !== null && rawFixes.length > MAX_BATCH_SIZE) {
    throw new AppError("LOCATION_BATCH_TOO_LARGE", "fixes batch exceeds the maximum of 100 entries", {
      max: MAX_BATCH_SIZE,
    });
  }

  const body = parseOrThrow(reportLocationsRequestSchema, input.body);

  const now = deps.clock.now();
  const maxAllowedMs = now.getTime() + CLOCK_SKEW_TOLERANCE_MS;
  const skewFields: string[] = [];
  body.fixes.forEach((fix, index) => {
    if (new Date(fix.recordedAt).getTime() > maxAllowedMs) {
      skewFields.push(`fixes[${index}].recordedAt`);
    }
  });
  if (skewFields.length > 0) {
    throw new AppError("VALIDATION_FAILED", "fix recordedAt is too far in the future (clock skew)", {
      fields: skewFields,
    });
  }

  const receivedAt = now.toISOString();
  const geofenceEtag = await deps.geofenceConfigRepo.getEtag(familyId);

  const inserted = await deps.idempotencyRepo.tryInsertBatchMarker(deviceId, body.batchId, {
    receivedAt,
    fixCount: body.fixes.length,
  });

  if (!inserted) {
    return {
      accepted: 0,
      duplicates: body.fixes.length,
      lastKnownUpdated: false,
      deviceSettings,
      geofenceEtag,
      features,
    };
  }

  const newest = newestFix(body.fixes);
  const lastKnownCandidate: LastKnownRecord = {
    deviceId,
    lat: newest.lat,
    lon: newest.lon,
    accuracyM: newest.accuracyM,
    ...(newest.altitudeM !== undefined ? { altitudeM: newest.altitudeM } : {}),
    ...(newest.speedMps !== undefined ? { speedMps: newest.speedMps } : {}),
    ...(newest.bearingDeg !== undefined ? { bearingDeg: newest.bearingDeg } : {}),
    batteryPct: newest.batteryPct,
    recordedAt: newest.recordedAt,
    receivedAt,
    source: newest.source,
  };
  const lastKnownUpdated = await deps.lastKnownRepo.upsertIfNewer(familyId, lastKnownCandidate);

  for (const fix of body.fixes) {
    await deps.historyStore.appendFix(familyId, input.uid, deviceId, buildFixLine(fix, receivedAt));
  }

  const date = usageDate(now);
  await deps.usageRepo.increment(familyId, "apiCalls", date);
  await deps.usageRepo.increment(familyId, "locationBatches", date);
  await deps.usageRepo.increment(familyId, "fixes", date, body.fixes.length);

  return {
    accepted: body.fixes.length,
    duplicates: 0,
    lastKnownUpdated,
    deviceSettings,
    geofenceEtag,
    features,
  };
}
