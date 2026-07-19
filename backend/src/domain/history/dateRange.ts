// specs/001 §5.3/§7.4, §9 — history query date-range validation: real YYYY-MM-DD calendar
// dates, ordering, the 31-day span cap, and the historyDays retention window
// ("beyondRetention"). Pure (no Azure imports); mutation-tested directly.

import { AppError } from "../../http/errors";

const MAX_SPAN_DAYS = 31;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC midnight ms for a YYYY-MM-DD string, or NaN if the string isn't parseable. */
function parseUtcDateMs(dateStr: string): number {
  return Date.parse(`${dateStr}T00:00:00.000Z`);
}

/**
 * True only for a genuine YYYY-MM-DD UTC calendar date. This single check subsumes shape
 * validation too: the round-trip is always rebuilt as zero-padded 4-2-2 digits, so a
 * differently-shaped or malformed input (e.g. "2026-7-19", "07/19/2026", "2026-13-01",
 * "2026-02-30") can never match it back — there is no separate regex/shape gate to keep in
 * sync with this reconstruction.
 */
function isValidCalendarDate(dateStr: string): boolean {
  const ms = parseUtcDateMs(dateStr);
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
  const invalidFields: string[] = [];
  if (!isValidCalendarDate(from)) invalidFields.push("from");
  if (!isValidCalendarDate(to)) invalidFields.push("to");
  if (invalidFields.length > 0) {
    throw new AppError("VALIDATION_FAILED", "from/to must be valid YYYY-MM-DD calendar dates", {
      fields: invalidFields,
    });
  }

  const fromMs = parseUtcDateMs(from);
  const toMs = parseUtcDateMs(to);

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
