// specs/001 §3.5/§3.6 — the {userId} path param schema (docs/security-review-checklist.md
// §3: "validation before use" for path inputs, not just request bodies).

import { describe, expect, it } from "vitest";
import { memberUserIdParamSchema, parseOrThrow } from "../../../src/http/validate";
import { expectAppError } from "../../support/expectAppError";

/** parseOrThrow is synchronous; wrap the call so expectAppError can assert on the rejection. */
async function parse(input: unknown) {
  return parseOrThrow(memberUserIdParamSchema, input);
}

describe("http/validate memberUserIdParamSchema", () => {
  it("accepts a well-formed userId", async () => {
    const result = await parse({ userId: "u1" });

    expect(result).toEqual({ userId: "u1" });
  });

  it("accepts a userId at the 128-char max boundary", async () => {
    const userId = "x".repeat(128);

    const result = await parse({ userId });

    expect(result.userId).toBe(userId);
  });

  it('throws VALIDATION_FAILED with details.fields: ["userId"] for an empty userId', async () => {
    await expectAppError(parse({ userId: "" }), "VALIDATION_FAILED", { fields: ["userId"] });
  });

  it('throws VALIDATION_FAILED with details.fields: ["userId"] for a missing userId (path param absent)', async () => {
    await expectAppError(parse({ userId: undefined }), "VALIDATION_FAILED", { fields: ["userId"] });
  });

  it("throws VALIDATION_FAILED for a userId over the 128-char max", async () => {
    await expectAppError(parse({ userId: "x".repeat(129) }), "VALIDATION_FAILED", { fields: ["userId"] });
  });

  it.each([
    ["a/b", "forward slash"],
    ["a\\b", "backslash"],
    ["a#b", "hash"],
    ["a?b", "question mark"],
    ["ab", "control character"],
  ])("throws VALIDATION_FAILED for a userId containing a forbidden %s", async (malformed) => {
    await expectAppError(parse({ userId: malformed }), "VALIDATION_FAILED", { fields: ["userId"] });
  });

  it("still yields a well-formed userId through to the caller for domain-level MEMBER_NOT_FOUND handling", async () => {
    // A syntactically valid but non-existent userId MUST pass this schema unchanged — the
    // domain layer (not this schema) is responsible for the 404 MEMBER_NOT_FOUND outcome.
    const result = await parse({ userId: "no-such-user" });

    expect(result).toEqual({ userId: "no-such-user" });
  });
});
