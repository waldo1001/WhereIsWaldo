// specs/001 §4.1 — register/update own device. Pure domain logic: no Azure/Google imports.
// Devices are stored per-owner (002 §2.4): registration does not require a family (§1.5 step
// 4). A family member's devices live in the shared family partition (unchanged, pre-existing
// behavior); a family-less caller's devices live in their own uid partition — same DeviceRepo
// port, just a different partition-key value, so no B8 re-key work is needed here.

import { AppError } from "../../http/errors";
import { parseOrThrow, registerDeviceRequestSchema } from "../../http/validate";
import type { Clock } from "../../ports/support";
import type { DeviceRecord, DeviceRepo, EntitlementsRepo } from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";
import { toDeviceView, type DeviceView } from "./deviceView";

export interface RegisterDeviceDeps {
  deviceRepo: DeviceRepo;
  entitlementsRepo: EntitlementsRepo;
  clock: Clock;
}

export interface RegisterDeviceInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
  body: unknown;
}

export interface RegisterDeviceResult {
  /** true = 201 (new registration), false = 200 (upsert) — the function layer picks the status. */
  created: boolean;
  device: DeviceView;
  features: Features;
}

export async function registerDevice(
  input: RegisterDeviceInput,
  deps: RegisterDeviceDeps,
): Promise<RegisterDeviceResult> {
  // The device partition: the shared family partition for family members, the caller's own
  // uid for a family-less caller (002 §2.4 — "the partition is the owner").
  const partitionKey = input.familyId ?? input.uid;

  const body = parseOrThrow(registerDeviceRequestSchema, input.body);

  const existing = await deps.deviceRepo.getDevice(partitionKey, body.deviceId);
  if (existing && existing.ownerUserId !== input.uid) {
    throw new AppError("VALIDATION_FAILED", "deviceId is registered to a different user", {
      reason: "deviceIdInUse",
    });
  }

  let features: Features;
  if (input.familyId) {
    const entitlements = await deps.entitlementsRepo.get(input.familyId);
    if (!entitlements) {
      throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
    }
    features = getFeatures(entitlements.subscriptionStatus);
  } else {
    // Family-less callers have no Entitlements row — implicit free (001 §9, 002 §2.6).
    features = getFeatures("free");
  }

  const now = deps.clock.now().toISOString();

  if (!existing) {
    const count = await deps.deviceRepo.countDevices(partitionKey);
    if (count >= features.limits.maxDevices) {
      throw new AppError("LIMIT_EXCEEDED", "device cap reached", { limit: "maxDevices" });
    }

    const record: DeviceRecord = {
      deviceId: body.deviceId,
      ownerUserId: input.uid,
      platform: body.platform,
      model: body.model,
      appVersion: body.appVersion,
      deviceName: body.deviceName ?? body.model,
      pushToken: body.pushToken,
      locationPushToken: body.locationPushToken,
      pushInvalid: false,
      syncIntervalMinutes: 15,
      trackingEnabled: true,
      registeredAt: now,
      lastSeenAt: now,
    };
    await deps.deviceRepo.putDevice(partitionKey, record);
    return { created: true, device: toDeviceView(record), features };
  }

  const updated: DeviceRecord = {
    ...existing,
    platform: body.platform,
    model: body.model,
    appVersion: body.appVersion,
    // Fresh tokens replace the stored one; an omitted token preserves what's on file
    // (clients resend on every launch/refresh per §4.1, but a plain appVersion update
    // MUST NOT silently wipe out a previously-registered valid token).
    pushToken: body.pushToken ?? existing.pushToken,
    locationPushToken: body.locationPushToken ?? existing.locationPushToken,
    lastSeenAt: now,
    // Parent-managed settings are NEVER reset by an upsert (§4.1):
    syncIntervalMinutes: existing.syncIntervalMinutes,
    trackingEnabled: existing.trackingEnabled,
    deviceName: existing.deviceName,
  };
  await deps.deviceRepo.putDevice(partitionKey, updated);
  return { created: false, device: toDeviceView(updated), features };
}
