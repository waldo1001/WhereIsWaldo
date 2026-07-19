// specs/001 §3.4 — accept invite (authenticated user without a family). Pure domain
// logic: no Azure/Google imports.

import { AppError } from "../../http/errors";
import { acceptInviteRequestSchema, parseOrThrow } from "../../http/validate";
import type { Clock } from "../../ports/support";
import type {
  EntitlementsRepo,
  FamilyMember,
  FamilyRepo,
  InviteRepo,
  Role,
  UsageRepo,
  UserRepo,
} from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";
import { normalizeInviteCode } from "./inviteCode";

export interface AcceptInviteDeps {
  inviteRepo: InviteRepo;
  familyRepo: FamilyRepo;
  userRepo: UserRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  clock: Clock;
}

export interface AcceptInviteInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
  body: unknown;
}

export interface AcceptInviteResult {
  familyId: string;
  familyName: string;
  role: Role;
  features: Features;
}

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function acceptInvite(input: AcceptInviteInput, deps: AcceptInviteDeps): Promise<AcceptInviteResult> {
  if (input.familyId) {
    throw new AppError("FAMILY_ALREADY_MEMBER", "caller already belongs to a family");
  }

  const { inviteCode, displayName } = parseOrThrow(acceptInviteRequestSchema, input.body);
  const normalizedCode = normalizeInviteCode(inviteCode);

  const invite = await deps.inviteRepo.getInvite(normalizedCode);
  if (!invite) {
    throw new AppError("INVITE_INVALID", "unknown invite code");
  }

  const now = deps.clock.now();
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) {
    throw new AppError("INVITE_EXPIRED", "invite code expired");
  }

  // Validate the target family is fully set up before consuming the single-use code,
  // so an internal-data problem never burns the invite (defense-in-depth, 001 §3.4).
  const familyMeta = await deps.familyRepo.getFamilyMeta(invite.familyId);
  if (!familyMeta) {
    throw new AppError("INTERNAL_ERROR", "invite references a missing family");
  }
  const entitlements = await deps.entitlementsRepo.get(invite.familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  const features = getFeatures(entitlements.subscriptionStatus);

  const usedAt = now.toISOString();
  const consumeResult = await deps.inviteRepo.consumeInvite(normalizedCode, input.uid, usedAt);
  if (consumeResult === "alreadyUsed") {
    throw new AppError("INVITE_ALREADY_USED", "invite code already used");
  }

  const member: FamilyMember = { userId: input.uid, role: invite.role, displayName, joinedAt: usedAt };
  await deps.familyRepo.addMember(invite.familyId, member);
  await deps.userRepo.createProfile(input.uid, { familyId: invite.familyId, role: invite.role, displayName });
  await deps.usageRepo.increment(invite.familyId, "apiCalls", usageDate(now));

  return { familyId: invite.familyId, familyName: familyMeta.familyName, role: invite.role, features };
}
