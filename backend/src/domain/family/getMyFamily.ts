// specs/001 §3.2 — get my family. Pure domain logic: no Azure/Google imports.

import { AppError } from "../../http/errors";
import type { EntitlementsRepo, FamilyMember, FamilyRepo, Role } from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";

export interface GetMyFamilyDeps {
  familyRepo: FamilyRepo;
  entitlementsRepo: EntitlementsRepo;
}

export interface GetMyFamilyInput {
  uid: string;
  /** The caller's familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
}

export interface GetMyFamilyResult {
  familyId: string;
  familyName: string;
  createdAt: string;
  me: { userId: string; role: Role };
  members: FamilyMember[];
  features: Features;
}

export async function getMyFamily(input: GetMyFamilyInput, deps: GetMyFamilyDeps): Promise<GetMyFamilyResult> {
  if (!input.familyId) {
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  const familyId = input.familyId;

  const meta = await deps.familyRepo.getFamilyMeta(familyId);
  if (!meta) {
    throw new AppError("INTERNAL_ERROR", "family meta record missing");
  }

  const members = await deps.familyRepo.listMembers(familyId);
  // Invariant: FamilyRepo.addMember + UserRepo.createProfile are always written together
  // (createFamily/acceptInvite), so the caller always appears in their own family's roster.
  const me = members.find((m) => m.userId === input.uid)!;

  const entitlements = await deps.entitlementsRepo.get(familyId);
  if (!entitlements) {
    throw new AppError("INTERNAL_ERROR", "family has no entitlements record");
  }
  const features = getFeatures(entitlements.subscriptionStatus);

  return {
    familyId: meta.familyId,
    familyName: meta.familyName,
    createdAt: meta.createdAt,
    me: { userId: me.userId, role: me.role },
    members,
    features,
  };
}
