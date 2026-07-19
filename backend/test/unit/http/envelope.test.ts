import { describe, expect, it } from "vitest";
import { ok, fail } from "../../../src/http/envelope";
import { AppError, ERROR_STATUS } from "../../../src/http/errors";
import { getFeatures } from "../../../src/domain/plan";

describe("http/envelope", () => {
  describe("ok()", () => {
    it("always embeds features alongside data (001 §1.3)", () => {
      const features = getFeatures("free");
      const envelope = ok({ familyId: "fam_x" }, features);

      expect(envelope).toEqual({ data: { familyId: "fam_x" }, features });
    });

    it("does not mutate or merge data and features together", () => {
      const features = getFeatures("free");
      const envelope = ok({ features: "not-the-real-one" }, features);

      expect(envelope.data).toEqual({ features: "not-the-real-one" });
      expect(envelope.features).toEqual(features);
    });
  });

  describe("fail()", () => {
    it("matches the §1.3 error envelope shape with a requestId", () => {
      const error = new AppError("FAMILY_NOT_FOUND", "caller has no family");
      const envelope = fail(error, "r_a1b2c3d4");

      expect(envelope).toEqual({
        error: {
          code: "FAMILY_NOT_FOUND",
          message: "caller has no family",
          requestId: "r_a1b2c3d4",
        },
      });
    });

    it("includes details when the error carries them", () => {
      const error = new AppError("VALIDATION_FAILED", "bad body", { fields: ["familyName"] });
      const envelope = fail(error, "r_deadbeef");

      expect(envelope.error.details).toEqual({ fields: ["familyName"] });
    });

    it("omits the details key entirely when the error carries none", () => {
      const error = new AppError("AUTH_MISSING_TOKEN", "no header");
      const envelope = fail(error, "r_00000000");

      expect(envelope.error).not.toHaveProperty("details");
    });
  });

  describe("error code catalog (001 §10)", () => {
    it("contains exactly the 21 codes from the catalog — no invented codes", () => {
      const catalogCodes = [
        "AUTH_MISSING_TOKEN",
        "AUTH_INVALID_TOKEN",
        "AUTH_TOKEN_EXPIRED",
        "AUTH_FORBIDDEN",
        "TRACKING_PAUSED",
        "FAMILY_NOT_FOUND",
        "MEMBER_NOT_FOUND",
        "DEVICE_NOT_FOUND",
        "LOCATE_REQUEST_NOT_FOUND",
        "FAMILY_ALREADY_MEMBER",
        "GEOFENCE_VERSION_CONFLICT",
        "INVITE_EXPIRED",
        "LOCATE_REQUEST_EXPIRED",
        "INVITE_INVALID",
        "INVITE_ALREADY_USED",
        "VALIDATION_FAILED",
        "LOCATION_BATCH_TOO_LARGE",
        "LIMIT_EXCEEDED",
        "RATE_LIMITED",
        "INTERNAL_ERROR",
        "PUSH_DELIVERY_FAILED",
      ].sort();

      expect(Object.keys(ERROR_STATUS).sort()).toEqual(catalogCodes);
    });

    it("maps each code to the HTTP status from the §10 table", () => {
      expect(ERROR_STATUS.AUTH_MISSING_TOKEN).toBe(401);
      expect(ERROR_STATUS.AUTH_INVALID_TOKEN).toBe(401);
      expect(ERROR_STATUS.AUTH_TOKEN_EXPIRED).toBe(401);
      expect(ERROR_STATUS.AUTH_FORBIDDEN).toBe(403);
      expect(ERROR_STATUS.TRACKING_PAUSED).toBe(403);
      expect(ERROR_STATUS.FAMILY_NOT_FOUND).toBe(404);
      expect(ERROR_STATUS.MEMBER_NOT_FOUND).toBe(404);
      expect(ERROR_STATUS.DEVICE_NOT_FOUND).toBe(404);
      expect(ERROR_STATUS.LOCATE_REQUEST_NOT_FOUND).toBe(404);
      expect(ERROR_STATUS.FAMILY_ALREADY_MEMBER).toBe(409);
      expect(ERROR_STATUS.GEOFENCE_VERSION_CONFLICT).toBe(409);
      expect(ERROR_STATUS.INVITE_EXPIRED).toBe(410);
      expect(ERROR_STATUS.LOCATE_REQUEST_EXPIRED).toBe(410);
      expect(ERROR_STATUS.INVITE_INVALID).toBe(400);
      expect(ERROR_STATUS.INVITE_ALREADY_USED).toBe(400);
      expect(ERROR_STATUS.VALIDATION_FAILED).toBe(400);
      expect(ERROR_STATUS.LOCATION_BATCH_TOO_LARGE).toBe(400);
      expect(ERROR_STATUS.LIMIT_EXCEEDED).toBe(402);
      expect(ERROR_STATUS.RATE_LIMITED).toBe(429);
      expect(ERROR_STATUS.INTERNAL_ERROR).toBe(500);
      expect(ERROR_STATUS.PUSH_DELIVERY_FAILED).toBe(503);
    });

    it("AppError.httpStatus is derived from the catalog, not passed separately", () => {
      const error = new AppError("LIMIT_EXCEEDED", "device cap reached", { limit: "maxDevices" });
      expect(error.httpStatus).toBe(402);
      expect(error.code).toBe("LIMIT_EXCEEDED");
      expect(error.details).toEqual({ limit: "maxDevices" });
      expect(error.name).toBe("AppError");
    });
  });
});
