import { expect } from "vitest";
import { AppError, type ErrorCode } from "../../src/http/errors";

/**
 * Asserts a promise rejects with an AppError of the given code and a non-empty message
 * (catches "message stripped to ''" mutants that a bare code check would miss), plus
 * an optional deep-equality check on `details`.
 */
export async function expectAppError(
  promise: Promise<unknown>,
  code: ErrorCode,
  details?: Record<string, unknown>,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((err: AppError) => {
    expect(err.code).toBe(code);
    expect(err.message.length).toBeGreaterThan(0);
    if (details !== undefined) {
      expect(err.details).toEqual(details);
    }
  });
}
