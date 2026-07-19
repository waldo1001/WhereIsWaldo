// specs/001 §1.3 — success/error envelopes.

import type { Features } from "../domain/plan";
import type { AppError } from "./errors";

export interface SuccessEnvelope<T> {
  data: T;
  features: Features;
}

export interface ErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

export interface ErrorEnvelope {
  error: ErrorBody;
}

/** Every success response embeds `features` alongside `data` (001 §1.3, §9). */
export function ok<T>(data: T, features: Features): SuccessEnvelope<T> {
  return { data, features };
}

/** `requestId` is server-generated per request and echoed for correlation (001 §1.3). */
export function fail(error: AppError, requestId: string): ErrorEnvelope {
  const body: ErrorBody = {
    code: error.code,
    message: error.message,
    requestId,
  };
  if (error.details) {
    body.details = error.details;
  }
  return { error: body };
}
