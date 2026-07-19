// specs/001 §5.3/§7.4, §9 — history query date-range validation: YYYY-MM-DD format, real
// calendar dates, ordering, the 31-day span cap, and the historyDays retention window
// ("beyondRetention"). Pure (no Azure imports); mutation-tested directly.

import { AppError } from "../../http/errors";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 31;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC midnight ms for a YYYY-MM-DD string, or NaN if the string isn't parseable. */
function parseUtcDateMs(dateStr: string): number {
  return Date.parse(`${dateStr}T00:00:00.000Z`);
}

/** Rejects dates that parse but overflow their calendar (e.g. "2026-02-30" -> March 2). */
function isRealCalendarDate(dateStr: string, ms: number): boolean {
  if (Number.isNaN(ms)) return false;
  const d = new Date(ms);
  const roundTrip = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
  return roundTrip === dateStr;
}

function utcMidnightMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Validates the `from`/`to` history query params (001 §5.3/§7.4). Throws `VALIDATION_FAILED`
 * on any violation:
 *  - malformed / non-existent calendar dates -> `details.fields`
 *  - `to` before `from` -> `details.fields: ["to"]`
 *  - span > 31 days (inclusive) -> `details.fields: ["from", "to"]`
 *  - `from` older than `historyDays` back from `now` -> `details.reason: "beyondRetention"` (§9)
 */
export function validateHistoryDateRange(from: string, to: string, historyDays: number, now: Date): void {
  const formatFields: string[] = [];
  if (!DATE_RE.test(from)) formatFields.push("from");
  if (!DATE_RE.test(to)) formatFields.push("to");
  if (formatFields.length > 0) {
    throw new AppError("VALIDATION_FAILED", "from/to must be YYYY-MM-DD calendar dates", {
      fields: formatFields,
    });
  }

  const fromMs = parseUtcDateMs(from);
  const toMs = parseUtcDateMs(to);
  const calendarFields: string[] = [];
  if (!isRealCalendarDate(from, fromMs)) calendarFields.push("from");
  if (!isRealCalendarDate(to, toMs)) calendarFields.push("to");
  if (calendarFields.length > 0) {
    throw new AppError("VALIDATION_FAILED", "from/to must be valid calendar dates", {
      fields: calendarFields,
    });
  }

  if (toMs < fromMs) {
    throw new AppError("VALIDATION_FAILED", "to must not be before from", { fields: ["to"] });
  }

  const spanDays = Math.round((toMs - fromMs) / MS_PER_DAY) + 1;
  if (spanDays > MAX_SPAN_DAYS) {
    throw new AppError("VALIDATION_FAILED", "date span exceeds the maximum of 31 days", {
      fields: ["from", "to"],
    });
  }

  const earliestAllowedMs = utcMidnightMs(now) - historyDays * MS_PER_DAY;
  if (fromMs < earliestAllowedMs) {
    throw new AppError("VALIDATION_FAILED", "requested range predates the retention window", {
      reason: "beyondRetention",
    });
  }
}
