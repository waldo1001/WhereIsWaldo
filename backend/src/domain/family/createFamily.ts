// specs/001 §3.1 — create family. Pure domain logic: no Azure/Google imports.

import { AppError } from "../../http/errors";
import { createFamilyRequestSchema, parseOrThrow } from "../../http/validate";
import type { Clock, IdGenerator } from "../../ports/support";
import type {
  EntitlementsRepo,
  FamilyMember,
  FamilyRepo,
  Role,
  UserRepo,
  UsageRepo,
} from "../../ports/repositories";
import { getFeatures, type Features } from "../plan";

export interface CreateFamilyDeps {
  familyRepo: FamilyRepo;
  userRepo: UserRepo;
  entitlementsRepo: EntitlementsRepo;
  usageRepo: UsageRepo;
  idGenerator: IdGenerator;
  clock: Clock;
}

export interface CreateFamilyInput {
  uid: string;
  /** The caller's existing familyId from the resolved auth context (§1.5), null if no profile. */
  familyId: string | null;
  body: unknown;
}

export interface CreateFamilyResult {
  familyId: string;
  familyName: string;
  member: { userId: string; role: Extract<Role, "parent">; displayName: string };
  features: Features;
}

const FAMILY_ID_LENGTH = 20;

function usageDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function createFamily(input: CreateFamilyInput, deps: CreateFamilyDeps): Promise<CreateFamilyResult> {
  if (input.familyId) {
    throw new AppError("FAMILY_ALREADY_MEMBER", "caller already belongs to a family");
  }

  const { familyName, displayName } = parseOrThrow(createFamilyRequestSchema, input.body);

  const familyId = `fam_${deps.idGenerator.next(FAMILY_ID_LENGTH)}`;
  const now = deps.clock.now();
  const createdAt = now.toISOString();

  await deps.familyRepo.createFamily({ familyId, familyName, createdBy: input.uid, createdAt });

  const member: FamilyMember = { userId: input.uid, role: "parent", displayName, joinedAt: createdAt };
  await deps.familyRepo.addMember(familyId, member);
  await deps.userRepo.createProfile(input.uid, { familyId, role: "parent", displayName });
  await deps.entitlementsRepo.create(familyId, "free", createdAt);
  await deps.usageRepo.increment(familyId, "apiCalls", usageDate(now));

  return {
    familyId,
    familyName,
    member: { userId: input.uid, role: "parent", displayName },
    features: getFeatures("free"),
  };
}
