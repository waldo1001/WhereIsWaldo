// docs/security-review-checklist.md — "log IDs and counts, never coordinates, push
// tokens, or phone numbers, at info level and above." Every `*.functions.ts` catch-all
// used to pass the raw thrown `err` object straight to `context.error`. Azure SDK errors
// (e.g. `RestError`) can carry `request`/`response` payloads, and any other thrown value
// could carry arbitrary fields — this is the single place that reduces an unknown thrown
// value to the minimum safe-to-log shape, so no call site ever logs the raw object again.

export interface SafeErrorLog {
  message: string;
  code?: string;
}

/**
 * Distills any thrown value down to `{ message, code? }` — never the raw error/exception
 * object itself. Both fields are read only off actual `Error` instances (AppError, Azure
 * SDK errors like `RestError` — all real `Error` subclasses): `message` is never read off
 * an arbitrary non-Error thrown object's `.message`-shaped property, which could be
 * attacker- or bug-supplied with arbitrary content; anything not an `Error` is stringified
 * with no property access at all. `code` is included only when the `Error` exposes one as
 * a string.
 */
export function toSafeErrorLog(err: unknown): SafeErrorLog {
  if (!(err instanceof Error)) {
    return { message: String(err) };
  }
  const code = readStringCode(err);
  return code === undefined ? { message: err.message } : { message: err.message, code };
}

function readStringCode(err: Error): string | undefined {
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}
