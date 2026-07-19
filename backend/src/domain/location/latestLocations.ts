// specs/001 §5.2 — live map (latest location per family device). Pure domain logic: no
// Azure/Google imports. Joins three single-partition scans in memory (specs/002 §2.5).

import { AppError } from "../../http/errors";
import type { Clock } from "../../ports/support";
import type {
  DeviceRecord,
  DeviceRepo,
  EntitlementsRepo,
  FamilyRepo,
  FixSource,
  LastKnownRecord,
  LastKnownRepo,
  UsageRepo,
} from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";

export interface LatestLocationsDeps {
  familyRepo: FamilyRepo;
  deviceRepo: DeviceRepo;
  lastKnownRepo: LastKnownRepo;
  usageRepo: UsageRepo;
  entitlementsRepo: EntitlementsRepo;
  clock: Clock;
}

export interface LatestLocationsInput {
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
}

export interface MemberDeviceLocation {
  deviceId: string;
  deviceName: string;
  lat: number | null;
  lon: number | null;
  accuracyM: number | null;
  recordedAt: string | null;
  receivedAt: string | null;
  batteryPct: number | null;
  source: FixSource | null;
  trackingEnabled: boolean;
  syncIntervalMinutes: number;
  isStale: boolean | null;
}

export interface MemberLocations {
  userId: string;
  displayName: string;
  devices: MemberDeviceLocation[];
}

export interface LatestLocationsResult {
  members: MemberLocations[];
  features: Features;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function toDeviceLocation(device: DeviceRecord, lastKnown: LastKnownRecord | undefined, now: Date): MemberDeviceLocation {
  if (!lastKnown) {
    return {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      lat: null,
      lon: null,
      accuracyM: null,
      recordedAt: null,
      receivedAt: null,
      batteryPct: null,
      source: null,
      trackingEnabled: device.trackingEnabled,
      syncIntervalMinutes: device.syncIntervalMinutes,
      isStale: null,
    };
  }

  const ageMs = now.getTime() - new Date(lastKnown.recordedAt).getTime();
  const staleThresholdMs = 2 * device.syncIntervalMinutes * 60 * 1000;
  const isStale = ageMs > staleThresholdMs;

  return {
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    lat: lastKnown.lat,
    lon: lastKnown.lon,
    accuracyM: lastKnown.accuracyM,
    recordedAt: lastKnown.recordedAt,
    receivedAt: lastKnown.receivedAt,
    batteryPct: lastKnown.batteryPct,
    source: lastKnown.source,
    trackingEnabled: device.trackingEnabled,
    syncIntervalMinutes: device.syncIntervalMinutes,
    isStale,
  };
}

export async function latestLocations(
  input: LatestLocationsInput,
  deps: LatestLocationsDeps,
): Promise<LatestLocationsResult> {
  if (!input.familyId) {
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  const familyId = input.familyId;

  const entitlements = await deps.entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  const features = getFeatures(entitlements.subscriptionStatus);

  const [members, devices, lastKnowns] = await Promise.all([
    deps.familyRepo.listMembers(familyId),
    deps.deviceRepo.listDevices(familyId),
    deps.lastKnownRepo.listByFamily(familyId),
  ]);

  const lastKnownByDevice = new Map(lastKnowns.map((record) => [record.deviceId, record]));
  const devicesByOwner = new Map<string, DeviceRecord[]>();
  for (const device of devices) {
    const list = devicesByOwner.get(device.ownerUserId);
    if (list) {
      list.push(device);
    } else {
      devicesByOwner.set(device.ownerUserId, [device]);
    }
  }

  const now = deps.clock.now();

  const memberLocations: MemberLocations[] = members.map((member) => ({
    userId: member.userId,
    displayName: member.displayName,
    devices: (devicesByOwner.get(member.userId) ?? []).map((device) =>
      toDeviceLocation(device, lastKnownByDevice.get(device.deviceId), now),
    ),
  }));

  await deps.usageRepo.increment(familyId, "apiCalls", usageDate(now));

  return { members: memberLocations, features };
}
