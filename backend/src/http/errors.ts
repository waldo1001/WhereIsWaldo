// specs/001 §10 — the complete error-code catalog. Codes may not be invented elsewhere;
// every AppError in domain/http code MUST use a code from this map.

export const ERROR_STATUS = {
  AUTH_MISSING_TOKEN: 401,
  AUTH_INVALID_TOKEN: 401,
  AUTH_TOKEN_EXPIRED: 401,
  AUTH_FORBIDDEN: 403,
  TRACKING_PAUSED: 403,
  PROFILE_NOT_FOUND: 404,
  FAMILY_NOT_FOUND: 404,
  MEMBER_NOT_FOUND: 404,
  DEVICE_NOT_FOUND: 404,
  LOCATE_REQUEST_NOT_FOUND: 404,
  GROUP_NOT_FOUND: 404,
  FAMILY_ALREADY_MEMBER: 409,
  GEOFENCE_VERSION_CONFLICT: 409,
  GROUP_ALREADY_MEMBER: 409,
  GROUP_FULL: 409,
  INVITE_EXPIRED: 410,
  LOCATE_REQUEST_EXPIRED: 410,
  GROUP_EXPIRED: 410,
  INVITE_INVALID: 400,
  INVITE_ALREADY_USED: 400,
  GROUP_CODE_INVALID: 400,
  VALIDATION_FAILED: 400,
  LOCATION_BATCH_TOO_LARGE: 400,
  LIMIT_EXCEEDED: 402,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  PUSH_DELIVERY_FAILED: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = ERROR_STATUS[code];
    this.details = details;
  }
}
