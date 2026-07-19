import { describe, expect, it } from "vitest";
import { validateHistoryDateRange } from "../../../src/domain/history/dateRange";
import { expectAppError } from "../../support/expectAppError";

const NOW = new Date("2026-07-19T09:30:00Z");
const HISTORY_DAYS = 90;

async function run(from: string, to: string, historyDays = HISTORY_DAYS, now = NOW): Promise<void> {
  return Promise.resolve().then(() => validateHistoryDateRange(from, to, historyDays, now));
}

describe("domain/history/dateRange — validateHistoryDateRange (001 §5.3/§7.4, §9)", () => {
  it("accepts a valid single-day range", async () => {
    await expect(run("2026-07-19", "2026-07-19")).resolves.toBeUndefined();
  });

  it("accepts a valid multi-day range within the span cap", async () => {
    await expect(run("2026-07-01", "2026-07-19")).resolves.toBeUndefined();
  });

  it("accepts a range of exactly 31 days (the boundary is > 31, not >= 31)", async () => {
    // 2026-06-20 .. 2026-07-20 inclusive = 31 calendar days
    await expect(run("2026-06-20", "2026-07-20")).resolves.toBeUndefined();
  });

  it("rejects a range of 32 days (one past the cap)", async () => {
    await expectAppError(run("2026-06-19", "2026-07-20"), "VALIDATION_FAILED", {
      fields: ["from", "to"],
    });
  });

  it("rejects malformed from (not YYYY-MM-DD)", async () => {
    await expectAppError(run("07/19/2026", "2026-07-19"), "VALIDATION_FAILED", { fields: ["from"] });
  });

  it("rejects malformed to (not YYYY-MM-DD)", async () => {
    await expectAppError(run("2026-07-01", "19-07-2026"), "VALIDATION_FAILED", { fields: ["to"] });
  });

  it("rejects both from and to malformed, listing both fields", async () => {
    await expectAppError(run("bogus", "also-bogus"), "VALIDATION_FAILED", { fields: ["from", "to"] });
  });

  it("rejects an impossible calendar date (Feb 30) even though it matches the YYYY-MM-DD shape", async () => {
    await expectAppError(run("2026-02-30", "2026-03-01"), "VALIDATION_FAILED", { fields: ["from"] });
  });

  it("rejects an impossible calendar date in `to` specifically (not just `from`)", async () => {
    await expectAppError(run("2026-03-01", "2026-02-30"), "VALIDATION_FAILED", { fields: ["to"] });
  });

  it("rejects an out-of-range month (2026-13-01), which Date.parse turns into NaN rather than overflow", async () => {
    await expectAppError(run("2026-13-01", "2026-07-19"), "VALIDATION_FAILED", { fields: ["from"] });
  });

  it("rejects to before from", async () => {
    await expectAppError(run("2026-07-19", "2026-07-01"), "VALIDATION_FAILED", { fields: ["to"] });
  });

  it("rejects a from date older than the historyDays retention window", async () => {
    // NOW = 2026-07-19; historyDays=90 -> earliest allowed from = 2026-04-20.
    // 2026-04-19 is one day beyond the window.
    await expectAppError(run("2026-04-19", "2026-04-19", 90), "VALIDATION_FAILED", {
      reason: "beyondRetention",
    });
  });

  it("accepts a from date exactly at the historyDays retention boundary (not older than)", async () => {
    // Exactly 90 days back from 2026-07-19 is 2026-04-20 -> must be allowed (boundary is
    // strictly "older than", not "at or older than").
    await expect(run("2026-04-20", "2026-04-20", 90)).resolves.toBeUndefined();
  });

  it("uses the plan's historyDays, not a hardcoded literal (mutation gate, §11)", async () => {
    // With a 30-day plan, a from 40 days back must be rejected as beyondRetention even
    // though it would have passed under the default 90-day fixture.
    await expectAppError(run("2026-06-09", "2026-06-09", 30), "VALIDATION_FAILED", {
      reason: "beyondRetention",
    });
    await expect(run("2026-06-09", "2026-06-09", 90)).resolves.toBeUndefined();
  });
});
