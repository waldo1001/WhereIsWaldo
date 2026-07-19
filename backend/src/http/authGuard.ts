// specs/001 §1.5 — auth context resolution, performed on every request.

import { AppError } from "./errors";
import { TokenExpiredError, TokenInvalidError, type TokenVerifier } from "../ports/tokenVerifier";
import type { Role, UserRepo } from "../ports/repositories";

export interface AuthContext {
  uid: string;
  familyId: string | null;
  role: Role | null;
}

export interface AuthGuardDeps {
  tokenVerifier: TokenVerifier;
  userRepo: UserRepo;
}

export interface AuthGuardOptions {
  /** True only for POST /families and POST /invites/accept (§1.5 step 3 / §1.5.3). */
  allowNoProfile?: boolean;
}

const BEARER_PREFIX = "Bearer ";

/**
 * Resolves {uid, familyId, role} from the Authorization header (§1.5 steps 1-3).
 * Role checks against the endpoint's required role (§1.6) are the caller's responsibility.
 */
export async function authenticate(
  authorizationHeader: string | undefined | null,
  deps: AuthGuardDeps,
  options: AuthGuardOptions = {},
): Promise<AuthContext> {
  if (!authorizationHeader || !authorizationHeader.startsWith(BEARER_PREFIX)) {
    throw new AppError("AUTH_MISSING_TOKEN", "missing or malformed Authorization header");
  }
  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    throw new AppError("AUTH_MISSING_TOKEN", "missing bearer token");
  }

  let uid: string;
  try {
    const verified = await deps.tokenVerifier.verify(token);
    uid = verified.uid;
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      throw new AppError("AUTH_TOKEN_EXPIRED", "token expired");
    }
    if (err instanceof TokenInvalidError) {
      throw new AppError("AUTH_INVALID_TOKEN", err.message);
    }
    throw new AppError("AUTH_INVALID_TOKEN", "token verification failed");
  }

  const profile = await deps.userRepo.getProfile(uid);
  if (!profile) {
    if (options.allowNoProfile) {
      return { uid, familyId: null, role: null };
    }
    throw new AppError("FAMILY_NOT_FOUND", "caller has no family");
  }
  return { uid, familyId: profile.familyId, role: profile.role };
}
