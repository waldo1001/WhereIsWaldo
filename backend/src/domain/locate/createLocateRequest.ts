// specs/001 §6.1 — create locate request. Pure domain logic: no Azure/Google imports.

import { AppError } from "../../http/errors";
import { createLocateRequestRequestSchema, parseOrThrow } from "../../http/validate";
import type { Clock, IdGenerator } from "../../ports/support";
import type {
  DeviceRecord,
  DeviceRepo,
  EntitlementsRepo,
  FamilyRepo,
  LastKnownRecord,
  LastKnownRepo,
  LocateRequestRecord,
  LocateRequestRepo,
  LocateRequestStatus,
  UsageRepo,
} from "../../ports/repositories";
import type { PushSender } from "../../ports/pushSender";
import { getFeatures, type Features } from "../plan";

const REQUEST_ID_LENGTH = 20;
const EXPIRY_MS = 60 * 1000; // now + 60s (§6.1)

export interface CreateLocateRequestDeps {
  deviceRepo: DeviceRepo;
  familyRepo: FamilyRepo;
  lastKnownRepo: LastKnownRepo;
  locateRequestRepo: LocateRequestRepo;
  usageRepo: UsageRepo;
  entitlementsRepo: EntitlementsRepo;
  pushSender: PushSender;
  idGenerator: IdGenerator;
  clock: Clock;
}

export interface CreateLocateRequestInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
  body: unknown;
}

export interface LastKnownAnswer {
  deviceId: string;
  lat: number;
  lon: number;
  accuracyM: number;
  recordedAt: string;
}

export interface CreateLocateRequestResult {
  /** true = 201 (new request created), false = 200 (coalesced with an existing pending request). */
  created: boolean;
  requestId: string;
  status: LocateRequestStatus;
  targetUserId: string;
  targetDeviceId: string;
  expiresAt: string;
  lastKnown: LastKnownAnswer | null;
  features: Features;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function hasValidToken(device: DeviceRecord): boolean {
  return !!device.pushToken && !device.pushInvalid;
}

function mostRecentlySeen(devices: DeviceRecord[]): DeviceRecord {
  return devices.reduce((best, current) =>
    new Date(current.lastSeenAt).getTime() > new Date(best.lastSeenAt).getTime() ? current : best,
  );
}

/** specs/001 §6.1 ordered target resolution. */
async function resolveTarget(
  body: { targetUserId?: string; targetDeviceId?: string },
  familyId: string,
  deps: CreateLocateRequestDeps,
): Promise<{ targetUserId: string; device: DeviceRecord }> {
  if (body.targetDeviceId) {
    const device = await deps.deviceRepo.getDevice(familyId, body.targetDeviceId);
    if (!device) {
      throw new AppError("DEVICE_NOT_FOUND", "unknown targetDeviceId");
    }
    if (!device.trackingEnabled) {
      throw new AppError("TRACKING_PAUSED", "target device tracking is paused");
    }
    return { targetUserId: device.ownerUserId, device };
  }

  const targetUserId = body.targetUserId as string;
  const familyDevices = await deps.deviceRepo.listDevices(familyId);
  const candidates = familyDevices.filter((d) => d.ownerUserId === targetUserId);
  if (candidates.length === 0) {
    throw new AppError("DEVICE_NOT_FOUND", "target user has no registered devices");
  }
  const unpaused = candidates.filter((d) => d.trackingEnabled);
  if (unpaused.length === 0) {
    throw new AppError("TRACKING_PAUSED", "all of the target user's devices are paused");
  }
  const withValidToken = unpaused.filter(hasValidToken);
  const pool = withValidToken.length > 0 ? withValidToken : unpaused;
  return { targetUserId, device: mostRecentlySeen(pool) };
}

async function resolveRequesterDisplayName(
  uid: string,
  familyId: string,
  deps: CreateLocateRequestDeps,
): Promise<string> {
  const members = await deps.familyRepo.listMembers(familyId);
  const requester = members.find((member) => member.userId === uid);
  return requester?.displayName ?? uid;
}

function toLastKnownAnswer(deviceId: string, record: LastKnownRecord | null): LastKnownAnswer | null {
  if (!record) return null;
  return { deviceId, lat: record.lat, lon: record.lon, accuracyM: record.accuracyM, recordedAt: record.recordedAt };
}

export async function createLocateRequest(
  input: CreateLocateRequestInput,
  deps: CreateLocateRequestDeps,
): Promise<CreateLocateRequestResult> {
  if (!input.familyId) {
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  const familyId = input.familyId;

  const entitlements = await deps.entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  const features = getFeatures(entitlements.subscriptionStatus);

  const body = parseOrThrow(createLocateRequestRequestSchema, input.body);
  const { targetUserId, device } = await resolveTarget(body, familyId, deps);
  const targetDeviceId = device.deviceId;

  const now = deps.clock.now();
  const date = usageDate(now);
  const lastKnownRecord = await deps.lastKnownRepo.get(familyId, targetDeviceId);
  const lastKnown = toLastKnownAnswer(targetDeviceId, lastKnownRecord);

  const pending = await deps.locateRequestRepo.listPendingByTargetDevice(familyId, targetDeviceId);
  if (pending.length > 0) {
    const existing = pending[0]!;
    await deps.usageRepo.increment(familyId, "apiCalls", date);
    return {
      created: false,
      requestId: existing.requestId,
      status: existing.status,
      targetUserId,
      targetDeviceId,
      expiresAt: existing.expiresAt,
      lastKnown,
      features,
    };
  }

  const usedToday = await deps.usageRepo.get(familyId, "locateRequests", date);
  if (usedToday >= features.limits.locateRequestsPerDay) {
    throw new AppError("LIMIT_EXCEEDED", "daily locate-request quota reached", {
      limit: "locateRequestsPerDay",
    });
  }

  const requestId = `lr_${deps.idGenerator.next(REQUEST_ID_LENGTH)}`;
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + EXPIRY_MS).toISOString();

  let status: LocateRequestStatus = "pending";
  if (hasValidToken(device)) {
    const requestedByName = await resolveRequesterDisplayName(input.uid, familyId, deps);
    const outcome = await deps.pushSender.send({
      token: device.pushToken as string,
      type: "LOCATE_REQUEST",
      data: { type: "LOCATE_REQUEST", requestId, requestedByName, expiresAt },
    });
    if (outcome === "invalidToken") {
      status = "pushFailed";
      await deps.deviceRepo.putDevice(familyId, { ...device, pushInvalid: true });
    }
  } else {
    status = "pushFailed";
  }

  const record: LocateRequestRecord = {
    requestId,
    familyId,
    targetUserId,
    targetDeviceId,
    requestedBy: input.uid,
    status,
    createdAt,
    expiresAt,
  };
  await deps.locateRequestRepo.create(record);

  await deps.usageRepo.increment(familyId, "locateRequests", date);
  await deps.usageRepo.increment(familyId, "apiCalls", date);

  return {
    created: true,
    requestId,
    status,
    targetUserId,
    targetDeviceId,
    expiresAt,
    lastKnown,
    features,
  };
}
