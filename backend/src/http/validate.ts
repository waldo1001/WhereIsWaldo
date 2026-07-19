// specs/001 — zod request-body schemas + the shared parse-or-throw helper.
// VALIDATION_FAILED's `details.fields` (§10) is populated from zod issue paths.

import { z } from "zod";
import { AppError } from "./errors";

export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => (issue.path.length ? issue.path.join(".") : "(root)"));
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

// specs/001 §3.3 — role of the invitee; emailHint optional, valid email if present.
export const createInviteRequestSchema = z.object({
  role: z.enum(["parent", "member"]),
  emailHint: z.string().email().optional(),
});
export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;

// specs/001 §3.4 — inviteCode canonicalized by the domain (uppercase, no hyphen) after
// this schema only checks presence; displayName 1-30 chars (same rule as §3.1).
export const acceptInviteRequestSchema = z.object({
  inviteCode: z.string().min(1),
  displayName: z.string().min(1).max(30),
});
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;

// specs/001 §3.5 — at least one of role/displayName required.
export const updateMemberRequestSchema = z
  .object({
    role: z.enum(["parent", "member"]).optional(),
    displayName: z.string().min(1).max(30).optional(),
  })
  .refine((data) => data.role !== undefined || data.displayName !== undefined, {
    message: "at least one field (role or displayName) is required",
  });
export type UpdateMemberRequest = z.infer<typeof updateMemberRequestSchema>;
