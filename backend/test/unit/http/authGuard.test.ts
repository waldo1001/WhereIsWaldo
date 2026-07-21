import { describe, expect, it } from "vitest";
import { authenticate } from "../../../src/http/authGuard";
import { InMemoryUserRepo } from "../../fakes/inMemoryUserRepo";
import { StubTokenVerifier } from "../../fakes/stubTokenVerifier";
import { TokenExpiredError, TokenInvalidError } from "../../../src/ports/tokenVerifier";
import { expectAppError } from "../../support/expectAppError";

describe("http/authGuard authenticate()", () => {
  it("throws AUTH_MISSING_TOKEN when the Authorization header is absent", async () => {
    const tokenVerifier = new StubTokenVerifier();
    const userRepo = new InMemoryUserRepo();

    await expectAppError(authenticate(undefined, { tokenVerifier, userRepo }), "AUTH_MISSING_TOKEN");
  });

  it("throws AUTH_MISSING_TOKEN when the header is malformed (no Bearer prefix)", async () => {
    const tokenVerifier = new StubTokenVerifier();
    const userRepo = new InMemoryUserRepo();

    await expectAppError(
      authenticate("Basic abc123", { tokenVerifier, userRepo }),
      "AUTH_MISSING_TOKEN",
    );
  });

  it("throws AUTH_MISSING_TOKEN when the bearer token is empty/whitespace-only", async () => {
    const tokenVerifier = new StubTokenVerifier();
    const userRepo = new InMemoryUserRepo();

    await expectAppError(
      authenticate("Bearer    ", { tokenVerifier, userRepo }),
      "AUTH_MISSING_TOKEN",
    );
    expect(tokenVerifier.lastToken).toBeUndefined();
  });

  it("extracts and trims the bearer token before verifying", async () => {
    const tokenVerifier = new StubTokenVerifier();
    const userRepo = new InMemoryUserRepo();

    await authenticate("Bearer   my-token  ", { tokenVerifier, userRepo }, { allowNoProfile: true });

    expect(tokenVerifier.lastToken).toBe("my-token");
  });

  it("throws AUTH_INVALID_TOKEN carrying the verifier's own message for TokenInvalidError", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.throwOnVerify = new TokenInvalidError("bad signature");
    const userRepo = new InMemoryUserRepo();

    await expect(authenticate("Bearer sometoken", { tokenVerifier, userRepo })).rejects.toMatchObject({
      code: "AUTH_INVALID_TOKEN",
      message: "bad signature",
    });
  });

  it("throws AUTH_INVALID_TOKEN with a generic message for an unrecognized error", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.throwOnVerify = new Error("boom");
    const userRepo = new InMemoryUserRepo();

    await expect(authenticate("Bearer sometoken", { tokenVerifier, userRepo })).rejects.toMatchObject({
      code: "AUTH_INVALID_TOKEN",
      message: "token verification failed",
    });
  });

  it("throws AUTH_TOKEN_EXPIRED when the verifier throws TokenExpiredError", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.throwOnVerify = new TokenExpiredError();
    const userRepo = new InMemoryUserRepo();

    await expectAppError(
      authenticate("Bearer sometoken", { tokenVerifier, userRepo }),
      "AUTH_TOKEN_EXPIRED",
    );
  });

  it("happy path yields {uid, familyId, role} for a caller with a profile", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u1";
    const userRepo = new InMemoryUserRepo();
    userRepo.seed("u1", { familyId: "fam_abc", role: "parent", displayName: "Eric" });

    const ctx = await authenticate("Bearer sometoken", { tokenVerifier, userRepo });

    expect(ctx).toEqual({ uid: "u1", familyId: "fam_abc", role: "parent" });
  });

  it("throws PROFILE_NOT_FOUND when caller has no profile and the endpoint disallows it", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u2";
    const userRepo = new InMemoryUserRepo();

    await expectAppError(
      authenticate("Bearer sometoken", { tokenVerifier, userRepo }),
      "PROFILE_NOT_FOUND",
    );
  });

  it("allows no-profile callers through for the four §1.5.3 bootstrap endpoints", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u3";
    const userRepo = new InMemoryUserRepo();

    const ctx = await authenticate(
      "Bearer sometoken",
      { tokenVerifier, userRepo },
      { allowNoProfile: true },
    );

    expect(ctx).toEqual({ uid: "u3", familyId: null, role: null });
  });

  it("passes an existing family-less profile through unchanged (familyId/role null, §1.5 step 4)", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u4";
    const userRepo = new InMemoryUserRepo();
    userRepo.seed("u4", { familyId: null, role: null, displayName: "Group-only Noor" });

    const ctx = await authenticate("Bearer sometoken", { tokenVerifier, userRepo });

    expect(ctx).toEqual({ uid: "u4", familyId: null, role: null });
  });
});
