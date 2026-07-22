// docs/security-review-checklist.md — "log IDs and counts, never coordinates, push
// tokens, or phone numbers, at info level and above." The catch-all in every
// `*.functions.ts` file used to log the raw thrown `err` object directly to
// `context.error`. Azure SDK errors (e.g. `RestError`) and Node system errors can carry
// non-enumerable-but-real `request`/`response`/`config` payloads; `toSafeErrorLog` is the
// single place that distills any thrown value down to the minimum safe-to-log shape —
// `message` (and `code` when the thrown value exposes one as a string) — so every
// call site logs the same, provably-safe object instead of the raw error.

import { describe, expect, it } from "vitest";
import { toSafeErrorLog } from "../../../src/http/errorLogging";
import { AppError } from "../../../src/http/errors";

describe("http/errorLogging toSafeErrorLog", () => {
  it("returns only the message for a plain Error with no code", () => {
    const result = toSafeErrorLog(new Error("boom"));

    expect(result).toEqual({ message: "boom" });
  });

  it("omits the code key entirely when the error carries none (not code: undefined)", () => {
    const result = toSafeErrorLog(new Error("boom"));

    expect(result).not.toHaveProperty("code");
    expect(Object.keys(result)).toEqual(["message"]);
  });

  it("includes message and code for an Error exposing a string .code (Azure RestError shape)", () => {
    class FakeRestError extends Error {
      code = "ETIMEDOUT";
      // Real Azure RestErrors carry these — must never leak through.
      request = { url: "https://storage.example/devstoreaccount1/Devices", headers: { Authorization: "secret" } };
      response = { bodyAsText: "leaked body" };
    }

    const result = toSafeErrorLog(new FakeRestError("connection timed out"));

    expect(result).toEqual({ message: "connection timed out", code: "ETIMEDOUT" });
  });

  it("never includes any key beyond message/code, even when the source error has extra enumerable fields", () => {
    class FakeRestError extends Error {
      code = "ETIMEDOUT";
      request = { secret: "leak-me" };
      response = { secret: "leak-me-too" };
    }

    const result = toSafeErrorLog(new FakeRestError("timeout"));

    expect(Object.keys(result).sort()).toEqual(["code", "message"]);
  });

  it("uses AppError's message/code like any other Error subclass", () => {
    const result = toSafeErrorLog(new AppError("VALIDATION_FAILED", "bad body", { fields: ["name"] }));

    expect(result).toEqual({ message: "bad body", code: "VALIDATION_FAILED" });
  });

  it("stringifies a non-Error thrown value instead of reading its properties", () => {
    const thrown = { message: "not a real error", code: "FAKE", lat: 1.234, lng: 5.678 };

    const result = toSafeErrorLog(thrown);

    expect(result).toEqual({ message: "[object Object]" });
    expect(result).not.toHaveProperty("code");
  });

  it("stringifies a thrown string as-is and carries no code", () => {
    const result = toSafeErrorLog("string thrown, not an Error");

    expect(result).toEqual({ message: "string thrown, not an Error" });
  });

  it("ignores a non-string .code (e.g. a numeric errno) rather than logging it", () => {
    class NumericCodeError extends Error {
      code = 1234;
    }

    const result = toSafeErrorLog(new NumericCodeError("boom"));

    expect(result).toEqual({ message: "boom" });
  });

  it("handles null/undefined thrown values without throwing", () => {
    expect(toSafeErrorLog(null)).toEqual({ message: "null" });
    expect(toSafeErrorLog(undefined)).toEqual({ message: "undefined" });
  });
});
