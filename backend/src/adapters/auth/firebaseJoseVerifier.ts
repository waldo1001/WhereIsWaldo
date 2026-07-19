// specs/001 §2.2 — credential-free Firebase ID token verification via jose, plus the
// §2.3 AUTH_MODE=insecure-local escape hatch for local dev (Azurite / hand-crafted JWTs).

import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from "jose";
import { TokenExpiredError, TokenInvalidError, type TokenVerifier, type VerifiedToken } from "../../ports/tokenVerifier";

const FIREBASE_JWKS_URL = new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
);

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(FIREBASE_JWKS_URL);
  }
  return jwks;
}

export class FirebaseJoseVerifier implements TokenVerifier {
  constructor(private readonly projectId: string) {}

  async verify(token: string): Promise<VerifiedToken> {
    try {
      const { payload } = await jwtVerify(token, getJwks(), {
        issuer: `https://securetoken.google.com/${this.projectId}`,
        audience: this.projectId,
        algorithms: ["RS256"],
      });
      if (!payload.sub) {
        throw new TokenInvalidError("token missing sub claim");
      }
      return { uid: payload.sub };
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) {
        throw new TokenExpiredError();
      }
      if (err instanceof TokenInvalidError || err instanceof TokenExpiredError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : "token verification failed";
      throw new TokenInvalidError(message);
    }
  }
}

/**
 * §2.3 local dev only: accepts UNSIGNED tokens and trusts `sub` as-is. MUST refuse to run
 * in Azure — guarded by createTokenVerifier() checking WEBSITE_INSTANCE_ID before this
 * class is ever constructed.
 */
export class InsecureLocalTokenVerifier implements TokenVerifier {
  async verify(token: string): Promise<VerifiedToken> {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) {
      throw new TokenInvalidError("malformed token");
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch {
      throw new TokenInvalidError("malformed token payload");
    }
    const sub = payload.sub;
    if (typeof sub !== "string" || sub.length === 0) {
      throw new TokenInvalidError("token missing sub claim");
    }
    const exp = payload.exp;
    if (typeof exp === "number" && exp * 1000 < Date.now()) {
      throw new TokenExpiredError();
    }
    return { uid: sub };
  }
}

/** Builds the right verifier from app settings; refuses insecure-local mode inside Azure. */
export function createTokenVerifier(): TokenVerifier {
  if (process.env.AUTH_MODE === "insecure-local") {
    if (process.env.WEBSITE_INSTANCE_ID) {
      throw new Error("AUTH_MODE=insecure-local must never run in Azure (WEBSITE_INSTANCE_ID is set)");
    }
    return new InsecureLocalTokenVerifier();
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID app setting is required");
  }
  return new FirebaseJoseVerifier(projectId);
}
