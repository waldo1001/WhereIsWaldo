import type { TokenVerifier, VerifiedToken } from "../../src/ports/tokenVerifier";

export class StubTokenVerifier implements TokenVerifier {
  uid = "stub-uid";
  throwOnVerify: Error | null = null;
  /** The exact string authGuard passed to verify() — lets tests assert trimming/slicing. */
  lastToken: string | undefined;

  async verify(token: string): Promise<VerifiedToken> {
    this.lastToken = token;
    if (this.throwOnVerify) {
      throw this.throwOnVerify;
    }
    return { uid: this.uid };
  }
}
