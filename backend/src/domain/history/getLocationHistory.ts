// specs/001 §5.3 — location history. Pure domain logic: no Azure/Google imports. Blob I/O
// is delegated to the HistoryStore port (src/adapters/blobs/historyBlobStore.ts); this
// module owns param validation/normalization (date span, retention window) and the wire
// shape mapping.

import { AppError } from "../../http/errors";
import { locationHistoryQuerySchema, parseOrThrow } from "../../http/validate";
import type { Clock } from "../../ports/support";
import type { EntitlementsRepo, FixSource } from "../../ports/repositories";
import type { HistoryStore } from "../../ports/historyStore";
import { getFeatures, type Features } from "../plan";
import { validateHistoryDateRange } from "./dateRange";

const DEFAULT_LIMIT = 500;

export interface GetLocationHistoryDeps {
  historyStore: HistoryStore;
  entitlementsRepo: EntitlementsRepo;
  clock: Clock;
}

export interface GetLocationHistoryInput {
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
  /** Raw query params (userId, deviceId?, from, to, limit?, cursor?) — validated here. */
  query: unknown;
}

// specs/001 §5.3 — the point wire shape omits receivedAt/altitudeM/speedMps/bearingDeg
// (those exist on the stored FixLine but are not part of the history response).
export interface LocationHistoryPoint {
  deviceId: string;
  recordedAt: string;
  lat: number;
  lon: number;
  accuracyM: number;
  batteryPct: number;
  source: FixSource;
}

export interface GetLocationHistoryResult {
  points: LocationHistoryPoint[];
  nextCursor: string | null;
  features: Features;
}

export async function getLocationHistory(
  input: GetLocationHistoryInput,
  deps: GetLocationHistoryDeps,
): Promise<GetLocationHistoryResult> {
  if (!input.familyId) {
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  const familyId = input.familyId;

  const entitlements = await deps.entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  const features = getFeatures(entitlements.subscriptionStatus);

  const query = parseOrThrow(locationHistoryQuerySchema, input.query);

  const now = deps.clock.now();
  validateHistoryDateRange(query.from, query.to, features.limits.historyDays, now);

  const limit = query.limit ?? DEFAULT_LIMIT;
  const cursor = query.cursor ?? null;

  const page = await deps.historyStore.readFixHistory(
    familyId,
    query.userId,
    query.deviceId,
    query.from,
    query.to,
    limit,
    cursor,
  );

  const points: LocationHistoryPoint[] = page.items.map((item) => ({
    deviceId: item.deviceId,
    recordedAt: item.recordedAt,
    lat: item.lat,
    lon: item.lon,
    accuracyM: item.accuracyM,
    batteryPct: item.batteryPct,
    source: item.source,
  }));

  return { points, nextCursor: page.nextCursor, features };
}
