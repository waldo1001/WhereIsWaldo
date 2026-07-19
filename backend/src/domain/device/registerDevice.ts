// specs/001 §4.1 — register/update own device. Pure domain logic: no Azure/Google imports.

import { AppError } from "../../http/errors";
import { parseOrThrow, registerDeviceRequestSchema } from "../../http/validate";
import type { Clock } from "../../ports/support";
import type { DeviceRecord, DeviceRepo, EntitlementsRepo } from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";

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
  device: Omit<DeviceRecord, "registeredAt" | "lastSeenAt" | "locationPushToken" | "pushToken">;
  features: Features;
}

function toResultDevice(device: DeviceRecord): RegisterDeviceResult["device"] {
  return {
    deviceId: device.deviceId,
    ownerUserId: device.ownerUserId,
    platform: device.platform,
    model: device.model,
    appVersion: device.appVersion,
    deviceName: device.deviceName,
    pushInvalid: device.pushInvalid,
    syncIntervalMinutes: device.syncIntervalMinutes,
    trackingEnabled: device.trackingEnabled,
  };
}

export async function registerDevice(
  input: RegisterDeviceInput,
  deps: RegisterDeviceDeps,
): Promise<RegisterDeviceResult> {
  if (!input.familyId) {
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  const familyId = input.familyId;

  const body = parseOrThrow(registerDeviceRequestSchema, input.body);

  const existing = await deps.deviceRepo.getDevice(familyId, body.deviceId);
  if (existing && existing.ownerUserId !== input.uid) {
    throw new AppError("VALIDATION_FAILED", "deviceId is registered to a different user", {
      reason: "deviceIdInUse",
    });
  }

  const entitlements = await deps.entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  const features = getFeatures(entitlements.subscriptionStatus);

  const now = deps.clock.now().toISOString();

  if (!existing) {
    const count = await deps.deviceRepo.countDevices(familyId);
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
    await deps.deviceRepo.putDevice(familyId, record);
    return { created: true, device: toResultDevice(record), features };
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
  await deps.deviceRepo.putDevice(familyId, updated);
  return { created: false, device: toResultDevice(updated), features };
}
