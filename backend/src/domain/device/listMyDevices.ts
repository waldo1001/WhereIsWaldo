// specs/001 §4.2 — list devices. Pure domain logic: no Azure/Google imports. Open family:
// every member sees every device (settings-changes are still parent-gated, §4.3). A
// family-less caller gets their own devices only (same response shape, §1.5 step 4).

import { AppError } from "../../http/errors";
import type { Clock } from "../../ports/support";
import type { DeviceRepo, EntitlementsRepo, FamilyRepo, UsageRepo, UserRepo } from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";
import { toDeviceView, type DeviceView } from "./deviceView";

export interface ListMyDevicesDeps {
  deviceRepo: DeviceRepo;
  familyRepo: FamilyRepo;
  userRepo: UserRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface ListMyDevicesInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
}

export type DeviceListEntry = DeviceView & { ownerDisplayName: string; lastSeenAt: string };

export interface ListMyDevicesResult {
  devices: DeviceListEntry[];
  features: Features;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function listMyDevices(input: ListMyDevicesInput, deps: ListMyDevicesDeps): Promise<ListMyDevicesResult> {
  const now = deps.clock.now();

  if (input.familyId) {
    const familyId = input.familyId;
    const entitlements = await deps.entitlementsRepo.get(familyId);
    if (!entitlements) {
      throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
    }
    const features = getFeatures(entitlements.subscriptionStatus);

    const members = await deps.familyRepo.listMembers(familyId);
    const displayNameByUserId = new Map(members.map((m) => [m.userId, m.displayName]));
    const devices = await deps.deviceRepo.listDevices(familyId);

    await deps.usageRepo.increment(familyId, "apiCalls", usageDate(now));

    return {
      devices: devices.map((device) => ({
        ...toDeviceView(device),
        ownerDisplayName: displayNameByUserId.get(device.ownerUserId) ?? device.ownerUserId,
        lastSeenAt: device.lastSeenAt,
      })),
      features,
    };
  }

  // Family-less caller (§1.5 step 4, §4.2): own devices only, own uid partition (002 §2.4).
  const profile = await deps.userRepo.getProfile(input.uid);
  const ownerDisplayName = profile?.displayName ?? input.uid;
  const devices = await deps.deviceRepo.listDevices(input.uid);
  const features = getFeatures("free");

  await deps.usageRepo.increment(input.uid, "apiCalls", usageDate(now));

  return {
    devices: devices.map((device) => ({
      ...toDeviceView(device),
      ownerDisplayName,
      lastSeenAt: device.lastSeenAt,
    })),
    features,
  };
}
