// specs/001 §7.1 — get geofence config (whole document). Pure domain logic: no Azure/Google
// imports. Devices sync the whole document, supporting If-None-Match -> 304 (empty body,
// left to the http layer — this module just reports whether the caller's cached copy is
// still current).

import { AppError } from "../../http/errors";
import type { Clock } from "../../ports/support";
import type { EntitlementsRepo, UsageRepo } from "../../ports/repositories";
import type { GeofenceConfigRepo, GeofenceEntry } from "../../ports/geofenceConfig";
import { getFeatures, type Features } from "../plan";

export interface GetGeofencesDeps {
  geofenceConfigRepo: GeofenceConfigRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface GetGeofencesInput {
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
  /** The request's If-None-Match header value, or null when absent (§7.1). */
  ifNoneMatch: string | null;
}

export interface GetGeofencesResult {
  /** true => the http layer should respond bare 304 (empty body) — only the etag matters. */
  notModified: boolean;
  version: number;
  geofences: GeofenceEntry[];
  etag: string;
  features: Features;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function getGeofences(input: GetGeofencesInput, deps: GetGeofencesDeps): Promise<GetGeofencesResult> {
  if (!input.familyId) {
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  const familyId = input.familyId;

  const entitlements = await deps.entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  const features = getFeatures(entitlements.subscriptionStatus);

  const { config, etag } = await deps.geofenceConfigRepo.get(familyId);

  const now = deps.clock.now();
  await deps.usageRepo.increment(familyId, "apiCalls", usageDate(now));

  // `etag` is always a non-null string, so a null `ifNoneMatch` (header absent) can never
  // equal it — no separate null-guard needed (a redundant one would be an unkillable
  // equivalent mutant under Stryker, since `null === "<any string>"` is already false).
  const notModified = input.ifNoneMatch === etag;

  return { notModified, version: config.version, geofences: config.geofences, etag, features };
}
