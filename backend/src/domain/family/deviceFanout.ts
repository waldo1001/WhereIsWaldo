// specs/002 §2.4/§2.5 — Devices/LastKnown are keyed by ownerUserId, not familyId (B8
// re-key). Every family-wide read (001 §4.2 listing, §5.2 live map, §6.1 locate-flow target
// resolution, §8.2/§8.4 push fan-out) is therefore the `Families` roster plus one small
// per-member partition scan each, issued in parallel (bounded by family size). This module
// centralizes that fan-out so each call site doesn't reimplement it.

import type { DeviceRecord, DeviceRepo, FamilyMember, LastKnownRecord, LastKnownRepo } from "../../ports/repositories";

/** One `listDevices` partition scan per family member, merged (001 §4.2/§5.2/§6.1/§8). */
export async function listDevicesForMembers(members: FamilyMember[], deviceRepo: DeviceRepo): Promise<DeviceRecord[]> {
  const perMember = await Promise.all(members.map((member) => deviceRepo.listDevices(member.userId)));
  return perMember.flat();
}

/** One `listByOwner` partition scan per family member, merged (001 §5.2). */
export async function listLastKnownsForMembers(
  members: FamilyMember[],
  lastKnownRepo: LastKnownRepo,
): Promise<LastKnownRecord[]> {
  const perMember = await Promise.all(members.map((member) => lastKnownRepo.listByOwner(member.userId)));
  return perMember.flat();
}

/**
 * Finds one device by id anywhere in the family (001 §6.1's targetDeviceId branch, §4.3's
 * parent-edits-another-member's-device path) — the caller doesn't know which member owns
 * it up front, so this fans out across every member's partition and matches by deviceId.
 */
export async function findDeviceInFamily(
  members: FamilyMember[],
  deviceId: string,
  deviceRepo: DeviceRepo,
): Promise<DeviceRecord | null> {
  const devices = await listDevicesForMembers(members, deviceRepo);
  return devices.find((device) => device.deviceId === deviceId) ?? null;
}
