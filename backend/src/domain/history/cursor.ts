// specs/002 §3.3 — history-read cursor: opaque base64url JSON encoding "resume date + a
// per-blob byte offset" (001 §5.3, §7.4). Pure (no Azure imports) so this codec is
// independently mutation-tested; src/adapters/blobs/historyBlobStore.ts is the only real
// producer/consumer, but the domain history use-cases forward the string untouched — it is
// opaque to clients and callers alike.

import { z } from "zod";
import { AppError } from "../../http/errors";

const CURSOR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fixes: history/{familyId}/{userId}/{deviceId}/... — one blob per device, so the resume
// offset is a per-deviceId map.
const fixCursorSchema = z.object({
  d: z.string().regex(CURSOR_DATE_RE),
  o: z.record(z.string(), z.number().int().nonnegative()),
});
export type FixCursor = z.infer<typeof fixCursorSchema>;

// Events: events/{familyId}/... — one blob per family/day (all devices interleaved), so a
// single offset is enough.
const eventCursorSchema = z.object({
  d: z.string().regex(CURSOR_DATE_RE),
  o: z.number().int().nonnegative(),
});
export type EventCursor = z.infer<typeof eventCursorSchema>;

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf-8").toString("base64url");
}

function decode<T>(raw: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
  } catch {
    throw new AppError("VALIDATION_FAILED", "cursor is not a valid cursor", { fields: ["cursor"] });
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AppError("VALIDATION_FAILED", "cursor is not a valid cursor", { fields: ["cursor"] });
  }
  return result.data;
}

export function encodeFixCursor(cursor: FixCursor): string {
  return encode(cursor);
}

export function decodeFixCursor(raw: string): FixCursor {
  return decode(raw, fixCursorSchema);
}

export function encodeEventCursor(cursor: EventCursor): string {
  return encode(cursor);
}

export function decodeEventCursor(raw: string): EventCursor {
  return decode(raw, eventCursorSchema);
}
