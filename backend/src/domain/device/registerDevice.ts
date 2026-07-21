// specs/001 §4.1 — register/update own device. Pure domain logic: no Azure/Google imports.
// Devices are stored per-owner (002 §2.4, B8 re-key): registration does not require a
// family (§1.5 step 4). The partition is ALWAYS the caller's own uid — family membership
// no longer changes the partition key at all, so a caller's own devices are isolated from
// even their own family's other members (deviceId collisions across two different owners,
// even within the same family, are simply two different partitions now — 002 §2.4).

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
  // The device partition is always the caller's own uid (002 §2.4 — "the partition is the
  // owner"), family member or not.
  const ownerUserId = input.uid;

  const body = parseOrThrow(registerDeviceRequestSchema, input.body);

  const existing = await deps.deviceRepo.getDevice(ownerUserId, body.deviceId);
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
    const count = await deps.deviceRepo.countDevices(ownerUserId);
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
    await deps.deviceRepo.putDevice(ownerUserId, record);
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
  await deps.deviceRepo.putDevice(ownerUserId, updated);
  return { created: false, device: toDeviceView(updated), features };
}
