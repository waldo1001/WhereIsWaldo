// specs/001 — zod request-body schemas + the shared parse-or-throw helper.
// VALIDATION_FAILED's `details.fields` (§10) is populated from zod issue paths.

import { z } from "zod";
import { AppError } from "./errors";

// specs/001 §5.1/§10 — array indices use BRACKET notation (e.g. "fixes[3].recordedAt"),
// not dot-joined ("fixes.3.recordedAt"): a numeric segment appends as `[N]` with no
// leading dot; a named segment appends as `.name`, except when it's the first segment.
function formatFieldPath(path: (string | number)[]): string {
  if (path.length === 0) return "(root)";
  let formatted = "";
  path.forEach((segment, index) => {
    if (typeof segment === "number") {
      formatted += `[${segment}]`;
    } else if (index === 0) {
      formatted += segment;
    } else {
      formatted += `.${segment}`;
    }
  });
  return formatted;
}

export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => formatFieldPath(issue.path as (string | number)[]));
    throw new AppError("VALIDATION_FAILED", "request failed schema validation", { fields });
  }
  return result.data;
}

// specs/001 §3.1 — familyName 1-50 chars; displayName 1-30 chars.
export const createFamilyRequestSchema = z.object({
  familyName: z.string().min(1).max(50),
  displayName: z.string().min(1).max(30),
});
export type CreateFamilyRequest = z.infer<typeof createFamilyRequestSchema>;

// specs/001 §4.1 — deviceId/platform/model/appVersion required; rest optional.
export const registerDeviceRequestSchema = z.object({
  deviceId: z.string().uuid(),
  platform: z.enum(["android", "ios"]),
  model: z.string().min(1).max(60),
  appVersion: z.string().min(1),
  pushToken: z.string().min(1).optional(),
  locationPushToken: z.string().min(1).optional(),
  deviceName: z.string().min(1).max(40).optional(),
});
export type RegisterDeviceRequest = z.infer<typeof registerDeviceRequestSchema>;

// specs/001 §5.1 / §1.4 — one location fix. `fixes` array length (1-100) is enforced by
// the domain (LOCATION_BATCH_TOO_LARGE / VALIDATION_FAILED are distinct codes, §10), not here.
export const locationFixSchema = z.object({
  fixId: z.string().uuid(),
  recordedAt: z.string().datetime(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(10000),
  altitudeM: z.number().optional(),
  speedMps: z.number().min(0).optional(),
  bearingDeg: z.number().min(0).lt(360).optional(),
  batteryPct: z.number().int().min(0).max(100),
  source: z.enum(["periodic", "locate", "geofence", "manual"]),
});
export type LocationFixRequest = z.infer<typeof locationFixSchema>;

// specs/001 §5.1 — batchId + at least one fix (empty batch -> VALIDATION_FAILED here;
// the >100 cap is a separate pre-check in the domain, see above).
export const reportLocationsRequestSchema = z.object({
  batchId: z.string().uuid(),
  fixes: z.array(locationFixSchema).min(1),
});
export type ReportLocationsRequest = z.infer<typeof reportLocationsRequestSchema>;

// specs/001 §5.3 `GET /locations/history` query params. `from`/`to` format only; the
// 31-day span cap and the historyDays retention window are semantic checks owned by
// src/domain/history/dateRange.ts (mutation-tested there, not here).
export const locationHistoryQuerySchema = z.object({
  userId: z.string().min(1),
  deviceId: z.string().min(1).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  cursor: z.string().min(1).optional(),
});
export type LocationHistoryQuery = z.infer<typeof locationHistoryQuerySchema>;

// specs/001 §7.4 `GET /geofence-events` query params (the history READ; the POST at the
// same route is owned by B5, registered as a separate app.http handler).
export const geofenceEventHistoryQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  userId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  cursor: z.string().min(1).optional(),
});
export type GeofenceEventHistoryQuery = z.infer<typeof geofenceEventHistoryQuerySchema>;
