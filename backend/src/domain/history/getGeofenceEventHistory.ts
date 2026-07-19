// specs/001 §7.4 — geofence event history. Pure domain logic: no Azure/Google imports.
// Blob I/O is delegated to the HistoryStore port; this module owns param
// validation/normalization (date span, retention window) and the wire shape mapping.

import { AppError } from "../../http/errors";
import { geofenceEventHistoryQuerySchema, parseOrThrow } from "../../http/validate";
import type { Clock } from "../../ports/support";
import type { EntitlementsRepo, UsageRepo } from "../../ports/repositories";
import type { HistoryStore } from "../../ports/historyStore";
import { getFeatures, type Features } from "../plan";
import { validateHistoryDateRange } from "./dateRange";

const DEFAULT_LIMIT = 500;

export interface GetGeofenceEventHistoryDeps {
  historyStore: HistoryStore;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface GetGeofenceEventHistoryInput {
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
  /** Raw query params (from, to, userId?, limit?, cursor?) — validated here. */
  query: unknown;
}

// specs/001 §7.4 — the event wire shape drops eventId (client-generated dedupe key, not
// part of the history response) but, unlike location points, keeps receivedAt.
export interface GeofenceHistoryEvent {
  userId: string;
  deviceId: string;
  geofenceId: string;
  geofenceName: string | null;
  lat: number | null;
  lon: number | null;
  radiusM: number | null;
  transition: "enter" | "exit";
  recordedAt: string;
  receivedAt: string;
}

export interface GetGeofenceEventHistoryResult {
  events: GeofenceHistoryEvent[];
  nextCursor: string | null;
  features: Features;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function getGeofenceEventHistory(
  input: GetGeofenceEventHistoryInput,
  deps: GetGeofenceEventHistoryDeps,
): Promise<GetGeofenceEventHistoryResult> {
  if (!input.familyId) {
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  const familyId = input.familyId;

  const entitlements = await deps.entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  const features = getFeatures(entitlements.subscriptionStatus);

  const query = parseOrThrow(geofenceEventHistoryQuerySchema, input.query);

  const now = deps.clock.now();
  validateHistoryDateRange(query.from, query.to, features.limits.historyDays, now);

  const limit = query.limit ?? DEFAULT_LIMIT;
  const cursor = query.cursor ?? null;

  const page = await deps.historyStore.readEventHistory(
    familyId,
    query.from,
    query.to,
    query.userId,
    limit,
    cursor,
  );

  const events: GeofenceHistoryEvent[] = page.items.map((item) => ({
    userId: item.userId,
    deviceId: item.deviceId,
    geofenceId: item.geofenceId,
    geofenceName: item.geofenceName,
    lat: item.lat,
    lon: item.lon,
    radiusM: item.radiusM,
    transition: item.transition,
    recordedAt: item.recordedAt,
    receivedAt: item.receivedAt,
  }));

  await deps.usageRepo.increment(familyId, "apiCalls", usageDate(now));

  return { events, nextCursor: page.nextCursor, features };
}
