// specs/001 §2 — Firebase ID token verification, abstracted so src/http/authGuard.ts
// never touches jose/network directly (that lives in src/adapters/auth).

export interface VerifiedToken {
  uid: string;
}

/** Thrown by a TokenVerifier when the token's `exp` has passed (→ 401 AUTH_TOKEN_EXPIRED). */
export class TokenExpiredError extends Error {
  constructor(message = "token expired") {
    super(message);
    this.name = "TokenExpiredError";
  }
}

/** Thrown by a TokenVerifier for any other verification failure (→ 401 AUTH_INVALID_TOKEN). */
export class TokenInvalidError extends Error {
  constructor(message = "token invalid") {
    super(message);
    this.name = "TokenInvalidError";
  }
}

export interface TokenVerifier {
  /**
   * Verifies a bearer token and returns the caller's uid.
   * MUST throw TokenExpiredError / TokenInvalidError (or let another error propagate,
   * which authGuard also maps to AUTH_INVALID_TOKEN) — never resolve for an invalid token.
   */
  verify(token: string): Promise<VerifiedToken>;
}
