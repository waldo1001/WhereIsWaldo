import { describe, expect, it } from "vitest";
import { authenticate } from "../../../src/http/authGuard";
import { InMemoryUserRepo } from "../../fakes/inMemoryUserRepo";
import { InMemoryUsageRepo } from "../../fakes/inMemoryUsageRepo";
import { StubTokenVerifier } from "../../fakes/stubTokenVerifier";
import { FixedClock } from "../../fakes/fixedClock";
import { TokenExpiredError, TokenInvalidError } from "../../../src/ports/tokenVerifier";
import { expectAppError } from "../../support/expectAppError";

const NOW = new Date("2026-07-22T10:00:00.000Z");
const USAGE_DATE = "2026-07-22";

function deps(overrides: { tokenVerifier?: StubTokenVerifier; userRepo?: InMemoryUserRepo } = {}) {
  return {
    tokenVerifier: overrides.tokenVerifier ?? new StubTokenVerifier(),
    userRepo: overrides.userRepo ?? new InMemoryUserRepo(),
    usageRepo: new InMemoryUsageRepo(),
    clock: new FixedClock(NOW),
  };
}

describe("http/authGuard authenticate()", () => {
  it("throws AUTH_MISSING_TOKEN when the Authorization header is absent", async () => {
    await expectAppError(authenticate(undefined, deps()), "AUTH_MISSING_TOKEN");
  });

  it("throws AUTH_MISSING_TOKEN when the header is malformed (no Bearer prefix)", async () => {
    await expectAppError(authenticate("Basic abc123", deps()), "AUTH_MISSING_TOKEN");
  });

  it("throws AUTH_MISSING_TOKEN when the bearer token is empty/whitespace-only", async () => {
    const tokenVerifier = new StubTokenVerifier();
    await expectAppError(authenticate("Bearer    ", deps({ tokenVerifier })), "AUTH_MISSING_TOKEN");
    expect(tokenVerifier.lastToken).toBeUndefined();
  });

  it("extracts and trims the bearer token before verifying", async () => {
    const tokenVerifier = new StubTokenVerifier();
    await authenticate("Bearer   my-token  ", deps({ tokenVerifier }), { allowNoProfile: true });

    expect(tokenVerifier.lastToken).toBe("my-token");
  });

  it("throws AUTH_INVALID_TOKEN carrying the verifier's own message for TokenInvalidError", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.throwOnVerify = new TokenInvalidError("bad signature");

    await expect(authenticate("Bearer sometoken", deps({ tokenVerifier }))).rejects.toMatchObject({
      code: "AUTH_INVALID_TOKEN",
      message: "bad signature",
    });
  });

  it("throws AUTH_INVALID_TOKEN with a generic message for an unrecognized error", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.throwOnVerify = new Error("boom");

    await expect(authenticate("Bearer sometoken", deps({ tokenVerifier }))).rejects.toMatchObject({
      code: "AUTH_INVALID_TOKEN",
      message: "token verification failed",
    });
  });

  it("throws AUTH_TOKEN_EXPIRED when the verifier throws TokenExpiredError", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.throwOnVerify = new TokenExpiredError();

    await expectAppError(authenticate("Bearer sometoken", deps({ tokenVerifier })), "AUTH_TOKEN_EXPIRED");
  });

  it("happy path yields {uid, familyId, role} for a caller with a profile", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u1";
    const userRepo = new InMemoryUserRepo();
    userRepo.seed("u1", { familyId: "fam_abc", role: "parent", displayName: "Eric" });

    const ctx = await authenticate("Bearer sometoken", deps({ tokenVerifier, userRepo }));

    expect(ctx).toEqual({ uid: "u1", familyId: "fam_abc", role: "parent" });
  });

  it("throws PROFILE_NOT_FOUND when caller has no profile and the endpoint disallows it", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u2";

    await expectAppError(authenticate("Bearer sometoken", deps({ tokenVerifier })), "PROFILE_NOT_FOUND");
  });

  it("allows no-profile callers through for the four §1.5.3 bootstrap endpoints", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u3";

    const ctx = await authenticate("Bearer sometoken", deps({ tokenVerifier }), { allowNoProfile: true });

    expect(ctx).toEqual({ uid: "u3", familyId: null, role: null });
  });

  it("passes an existing family-less profile through unchanged (familyId/role null, §1.5 step 4)", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u4";
    const userRepo = new InMemoryUserRepo();
    userRepo.seed("u4", { familyId: null, role: null, displayName: "Group-only Noor" });

    const ctx = await authenticate("Bearer sometoken", deps({ tokenVerifier, userRepo }));

    expect(ctx).toEqual({ uid: "u4", familyId: null, role: null });
  });

  // specs/001 §9 (B14) — apiCalls: "+1 per authenticated request (any endpoint, once auth
  // succeeds)". These tests pin the single call site down: it must fire exactly once per
  // authenticated request regardless of downstream outcome, and never for a request that
  // fails to authenticate at all.

  it("apiCalls: increments once under the caller's familyId when the caller has a family", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u1";
    const userRepo = new InMemoryUserRepo();
    userRepo.seed("u1", { familyId: "fam_abc", role: "parent", displayName: "Eric" });
    const usageRepo = new InMemoryUsageRepo();

    await authenticate("Bearer sometoken", { tokenVerifier, userRepo, usageRepo, clock: new FixedClock(NOW) });

    expect(await usageRepo.get("fam_abc", "apiCalls", USAGE_DATE)).toBe(1);
    expect(await usageRepo.get("u1", "apiCalls", USAGE_DATE)).toBe(0);
  });

  it("apiCalls: increments once under the caller's own uid for an existing family-less profile", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u4";
    const userRepo = new InMemoryUserRepo();
    userRepo.seed("u4", { familyId: null, role: null, displayName: "Group-only Noor" });
    const usageRepo = new InMemoryUsageRepo();

    await authenticate("Bearer sometoken", { tokenVerifier, userRepo, usageRepo, clock: new FixedClock(NOW) });

    expect(await usageRepo.get("u4", "apiCalls", USAGE_DATE)).toBe(1);
  });

  it("apiCalls: increments once under the caller's uid for a bootstrap (allowNoProfile) caller with no profile yet", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u3";
    const usageRepo = new InMemoryUsageRepo();

    await authenticate(
      "Bearer sometoken",
      { tokenVerifier, userRepo: new InMemoryUserRepo(), usageRepo, clock: new FixedClock(NOW) },
      { allowNoProfile: true },
    );

    expect(await usageRepo.get("u3", "apiCalls", USAGE_DATE)).toBe(1);
  });

  it("apiCalls: still increments once (under uid) even when about to throw PROFILE_NOT_FOUND — a 4xx after auth succeeds still counts", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.uid = "u2";
    const usageRepo = new InMemoryUsageRepo();

    await expectAppError(
      authenticate("Bearer sometoken", {
        tokenVerifier,
        userRepo: new InMemoryUserRepo(),
        usageRepo,
        clock: new FixedClock(NOW),
      }),
      "PROFILE_NOT_FOUND",
    );

    expect(await usageRepo.get("u2", "apiCalls", USAGE_DATE)).toBe(1);
  });

  it("apiCalls: never increments when the token is missing (401, auth never succeeds)", async () => {
    const usageRepo = new InMemoryUsageRepo();

    await expectAppError(
      authenticate(undefined, {
        tokenVerifier: new StubTokenVerifier(),
        userRepo: new InMemoryUserRepo(),
        usageRepo,
        clock: new FixedClock(NOW),
      }),
      "AUTH_MISSING_TOKEN",
    );

    // No uid was ever resolved, so there's no partition to even check against a stray
    // increment — assert the repo recorded nothing at all for this date.
    expect(await usageRepo.get("anything", "apiCalls", USAGE_DATE)).toBe(0);
  });

  it("apiCalls: never increments when the token fails verification (401, auth never succeeds)", async () => {
    const tokenVerifier = new StubTokenVerifier();
    tokenVerifier.throwOnVerify = new TokenInvalidError("bad signature");
    const usageRepo = new InMemoryUsageRepo();

    await expectAppError(
      authenticate("Bearer sometoken", {
        tokenVerifier,
        userRepo: new InMemoryUserRepo(),
        usageRepo,
        clock: new FixedClock(NOW),
      }),
      "AUTH_INVALID_TOKEN",
    );

    expect(await usageRepo.get("anything", "apiCalls", USAGE_DATE)).toBe(0);
  });
});
