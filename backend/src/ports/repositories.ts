// Repository ports the domain depends on. Interfaces only — real implementations live in
// src/adapters/tables/*; test/fakes/* provides in-memory versions for unit tests.
// Shapes follow specs/002-storage-schema.md tables 1:1; wire shapes are specs/001's problem, not these.

import type { SubscriptionStatus } from "../domain/plan";

export type Role = "parent" | "member";

// ---------------------------------------------------------------------------
// Families (specs/002 §2.1) — specs/001 §3.1 (this task), §3.2/3.5/3.6 (later tasks)
// ---------------------------------------------------------------------------

export interface FamilyMeta {
  familyId: string;
  familyName: string;
  createdBy: string;
  createdAt: string;
}

export interface FamilyMember {
  userId: string;
  role: Role;
  displayName: string;
  joinedAt: string;
}

export interface FamilyRepo {
  /** Conditional insert of the `meta` row (001 §3.1). */
  createFamily(meta: FamilyMeta): Promise<void>;
  /** Point read of the `meta` row (001 §3.2). */
  getFamilyMeta(familyId: string): Promise<FamilyMeta | null>;
  /** Writes one `member:{userId}` row (001 §3.1 creator, §3.4 invite accept). */
  addMember(familyId: string, member: FamilyMember): Promise<void>;
  /** Partition range scan of `member:` rows = the roster (001 §3.2). */
  listMembers(familyId: string): Promise<FamilyMember[]>;
  /** Guarded update of a single member row (001 §3.5). */
  updateMember(
    familyId: string,
    userId: string,
    patch: Partial<Pick<FamilyMember, "role" | "displayName">>,
  ): Promise<FamilyMember>;
  /** Removes a member row (001 §3.6). */
  removeMember(familyId: string, userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Users — the auth hot path (specs/002 §2.2, specs/001 §1.5)
// ---------------------------------------------------------------------------

export interface UserProfile {
  /** Nullable — family-less users (groups only, 001 §1.5, 002 §2.2). */
  familyId: string | null;
  /** Denormalized from Families; null iff familyId is null (002 §2.2). */
  role: Role | null;
  displayName: string;
}

// specs/002 §2.2 — the `group:{groupId}` reverse-index row: "my groups" without a
// cross-partition query. Deliberately does NOT denormalize name/endsAt (see 002 §2.2).
export type GroupRole = "owner" | "member";

export interface GroupMembershipIndexEntry {
  groupId: string;
  role: GroupRole;
  joinedAt: string;
}

export interface UserRepo {
  /** The one point read every authenticated request performs (001 §1.5). */
  getProfile(userId: string): Promise<UserProfile | null>;
  /** Written alongside FamilyRepo.addMember in the same logical operation (001 §3.1, §3.4). */
  createProfile(userId: string, profile: UserProfile): Promise<void>;
  /** Role/displayName changes (001 §3.5) — Families stays the source of truth, this is a cache. */
  updateProfile(userId: string, patch: Partial<UserProfile>): Promise<void>;
  /** Membership removal (001 §3.6). */
  deleteProfile(userId: string): Promise<void>;
  /** Writes one `group:{groupId}` reverse-index row (001 §12.1/§12.6, 002 §2.2). */
  addGroupMembership(userId: string, entry: GroupMembershipIndexEntry): Promise<void>;
  /** Partition scan of `group:` rows = the "my groups" reverse index (001 §12.2, 002 §2.2). */
  listGroupMemberships(userId: string): Promise<GroupMembershipIndexEntry[]>;
}

// ---------------------------------------------------------------------------
// Invites (specs/002 §2.3, specs/001 §3.3/§3.4) — later task (B3)
// ---------------------------------------------------------------------------

export interface InviteRecord {
  inviteCode: string;
  familyId: string;
  role: Role;
  emailHint?: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedBy?: string;
  usedAt?: string;
}

export type ConsumeInviteResult = "ok" | "alreadyUsed";

export interface InviteRepo {
  createInvite(invite: InviteRecord): Promise<void>;
  getInvite(inviteCode: string): Promise<InviteRecord | null>;
  /** ETag-guarded merge setting usedBy/usedAt; race-safe (001 §3.4, 002 §2.3). */
  consumeInvite(inviteCode: string, usedBy: string, usedAt: string): Promise<ConsumeInviteResult>;
}

// ---------------------------------------------------------------------------
// Devices (specs/002 §2.4, specs/001 §4.1 — this task; §4.2/§4.3 later)
// ---------------------------------------------------------------------------

export type DevicePlatform = "android" | "ios";

export interface DeviceRecord {
  deviceId: string;
  ownerUserId: string;
  platform: DevicePlatform;
  model: string;
  appVersion: string;
  deviceName: string;
  pushToken?: string;
  locationPushToken?: string;
  pushInvalid: boolean;
  syncIntervalMinutes: number;
  trackingEnabled: boolean;
  registeredAt: string;
  lastSeenAt: string;
}

export interface DeviceRepo {
  getDevice(familyId: string, deviceId: string): Promise<DeviceRecord | null>;
  /** Full upsert write — the domain computes the final merged state (001 §4.1). */
  putDevice(familyId: string, device: DeviceRecord): Promise<void>;
  /** Partition scan = family device list (001 §4.2), push fan-out (§8.2/§8.4). */
  listDevices(familyId: string): Promise<DeviceRecord[]>;
  /** Partition scan count = the device-cap check (001 §4.1). */
  countDevices(familyId: string): Promise<number>;
  /** Removes all device registrations owned by a user within a family (001 §3.6). */
  deleteDevicesByOwner(familyId: string, userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// LastKnown (specs/002 §2.5, specs/001 §5.2) — later task (B2)
// ---------------------------------------------------------------------------

export type FixSource = "periodic" | "locate" | "geofence" | "manual";

export interface LastKnownRecord {
  deviceId: string;
  lat: number;
  lon: number;
  accuracyM: number;
  altitudeM?: number;
  speedMps?: number;
  bearingDeg?: number;
  batteryPct: number;
  recordedAt: string;
  receivedAt: string;
  source: FixSource;
}

export interface LastKnownRepo {
  get(familyId: string, deviceId: string): Promise<LastKnownRecord | null>;
  /** Overwrite only if incoming recordedAt > stored recordedAt; returns whether it wrote (002 §2.5). */
  upsertIfNewer(familyId: string, record: LastKnownRecord): Promise<boolean>;
  /** Whole-family partition scan (001 §5.2). */
  listByFamily(familyId: string): Promise<LastKnownRecord[]>;
}

// ---------------------------------------------------------------------------
// Entitlements (specs/002 §2.6, specs/001 §3.1 — this task, §9)
// ---------------------------------------------------------------------------

export interface EntitlementsRecord {
  subscriptionStatus: SubscriptionStatus;
  updatedAt: string;
}

export interface EntitlementsRepo {
  /** Created at family creation with "free" (001 §3.1). */
  create(familyId: string, subscriptionStatus: SubscriptionStatus, updatedAt: string): Promise<void>;
  get(familyId: string): Promise<EntitlementsRecord | null>;
}

// ---------------------------------------------------------------------------
// LocateRequests (specs/002 §2.7, specs/001 §6) — later task (B4)
// ---------------------------------------------------------------------------

export type LocateRequestStatus = "pending" | "fulfilled" | "expired" | "pushFailed";

export interface LocateRequestRecord {
  requestId: string;
  familyId: string;
  targetUserId: string;
  targetDeviceId: string;
  requestedBy: string;
  status: LocateRequestStatus;
  createdAt: string;
  expiresAt: string;
  fixJson?: string;
}

export interface LocateRequestRepo {
  create(record: LocateRequestRecord): Promise<void>;
  /** Point read on poll (001 §6.2). */
  get(familyId: string, requestId: string): Promise<LocateRequestRecord | null>;
  update(familyId: string, requestId: string, patch: Partial<LocateRequestRecord>): Promise<void>;
  /** Partition scan filtered to pending + same target = coalescing (001 §6.1). */
  listPendingByTargetDevice(familyId: string, targetDeviceId: string): Promise<LocateRequestRecord[]>;
}

// ---------------------------------------------------------------------------
// IdempotencyMarkers (specs/002 §2.8, specs/001 §5.1/§7.3/§6.3) — later tasks (B2/B4)
// ---------------------------------------------------------------------------

export interface IdempotencyRepo {
  /** Conditional insert; false = already accepted (dedupe test, 001 §5.1). */
  tryInsertBatchMarker(
    deviceId: string,
    batchId: string,
    meta: { receivedAt: string; fixCount: number },
  ): Promise<boolean>;
  tryInsertEventMarker(deviceId: string, eventId: string, receivedAt: string): Promise<boolean>;
  tryInsertFixMarker(deviceId: string, fixId: string, receivedAt: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Usage (specs/002 §2.9, specs/001 §9 — this task exercises "apiCalls")
// ---------------------------------------------------------------------------

export type UsageMetric = "locationBatches" | "fixes" | "locateRequests" | "geofenceEvents" | "apiCalls";

export interface UsageRepo {
  /** Read → +by → ETag-guarded merge, retry loop handled by the adapter (002 §2.9). */
  increment(familyId: string, metric: UsageMetric, date: string, by?: number): Promise<void>;
  get(familyId: string, metric: UsageMetric, date: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Groups (specs/002 §2.10, specs/001 §12.1-§12.3/§12.6 — this task; §12.4-§12.9 later (B10))
// ---------------------------------------------------------------------------

export type GroupExpiryPolicy = "delete" | "grace" | "archive";

export interface GroupMeta {
  groupId: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  endsAt: string;
  expiryPolicy: GroupExpiryPolicy;
  /** Current join code, denormalized for display (002 §2.10) — NOT the source of truth for
   * validity; that's GroupCodeRepo/GroupCodes (002 §2.11). */
  code: string;
}

export interface GroupMember {
  userId: string;
  role: GroupRole;
  /** Per-group display name (005 §1) — chosen at create/join, not editable in v1. */
  displayName: string;
  joinedAt: string;
}

export interface GroupRepo {
  /** Conditional insert of the `meta` row (001 §12.1, 002 §2.10). */
  createGroupMeta(meta: GroupMeta): Promise<void>;
  /** Point read of the `meta` row (001 §12.2/§12.3/§12.6). */
  getGroupMeta(groupId: string): Promise<GroupMeta | null>;
  /** Conditional insert of one `member:{userId}` row — race-safe join (001 §12.1/§12.6, 002 §2.10). */
  addMember(groupId: string, member: GroupMember): Promise<void>;
  /** Partition scan of `member:` rows = the roster + memberCount (001 §12.2/§12.3/§12.6). */
  listMembers(groupId: string): Promise<GroupMember[]>;
  /** Point read of a single member row — membership + role check (001 §12.3/§12.6). */
  getMember(groupId: string, userId: string): Promise<GroupMember | null>;
}

// ---------------------------------------------------------------------------
// GroupCodes (specs/002 §2.11, specs/001 §12.6 — this task; §12.7 rotate later (B10))
// ---------------------------------------------------------------------------

export interface GroupCodeRecord {
  groupId: string;
  createdAt: string;
}

export interface GroupCodeRepo {
  /** Conditional insert of the `{code}` row (001 §12.1, 002 §2.11). */
  createCode(code: string, record: GroupCodeRecord): Promise<void>;
  /** Point read — the join lookup (001 §12.6, 002 §2.11). */
  getCode(code: string): Promise<GroupCodeRecord | null>;
}

// ---------------------------------------------------------------------------
// GroupExpiry (specs/002 §2.13 — the sweeper's index; this task only writes the initial
// row at create, B10 moves it on PATCH endsAt, B12 is the sweeper that reads it)
// ---------------------------------------------------------------------------

export type GroupExpiryAction = "expire" | "hardDelete";

export interface GroupExpiryRepo {
  /** Writes the `{bucketDate}:{groupId}` row (002 §2.13) — bucket is the UTC date
   * (`yyyy-MM-dd`) of the group's next lifecycle action. */
  putExpiryRow(bucketDate: string, groupId: string, action: GroupExpiryAction): Promise<void>;
}
