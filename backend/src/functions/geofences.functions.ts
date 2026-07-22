// specs/001 §7.1 `GET /api/v1/geofences`, §7.2 `PUT /api/v1/geofences` (parent), §7.3
// `POST /api/v1/geofence-events`. Thin: parse -> authenticate -> domain -> envelope. No
// business logic here (excluded from mutation, no unit tests — integration tests later).
//
// COORDINATION: `GET /api/v1/geofence-events` (§7.4, the history READ) is owned by task B6
// and registered in history.functions.ts under a different function name/handler — Azure
// Functions v4 allows separate `app.http` registrations per method on the same route, so
// this file registers the POST only and must not touch B6's GET.

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { randomUUID } from "node:crypto";
import { authenticate } from "../http/authGuard";
import { ok, fail } from "../http/envelope";
import { AppError } from "../http/errors";
import { toSafeErrorLog } from "../http/errorLogging";
import { getGeofences } from "../domain/geofence/getGeofences";
import { replaceGeofences } from "../domain/geofence/replaceGeofences";
import { reportGeofenceEvents } from "../domain/geofence/reportGeofenceEvents";
import { createTokenVerifier } from "../adapters/auth/firebaseJoseVerifier";
import { TableUserRepo } from "../adapters/tables/usersTableRepo";
import { TableFamilyRepo } from "../adapters/tables/familiesTableRepo";
import { TableDeviceRepo } from "../adapters/tables/devicesTableRepo";
import { TableEntitlementsRepo } from "../adapters/tables/entitlementsTableRepo";
import { TableUsageRepo } from "../adapters/tables/usageTableRepo";
import { TableIdempotencyRepo } from "../adapters/tables/idempotencyMarkersTableRepo";
import { BlobGeofenceConfigRepo } from "../adapters/blobs/geofenceConfigBlobRepo";
import { BlobHistoryStore } from "../adapters/blobs/historyBlobStore";
import { FcmV1Sender } from "../adapters/push/fcmV1Sender";
import { SystemClock } from "../adapters/support/systemClock";

const tokenVerifier = createTokenVerifier();
const userRepo = new TableUserRepo();
const familyRepo = new TableFamilyRepo();
const deviceRepo = new TableDeviceRepo();
const entitlementsRepo = new TableEntitlementsRepo();
const usageRepo = new TableUsageRepo();
const idempotencyRepo = new TableIdempotencyRepo();
const geofenceConfigRepo = new BlobGeofenceConfigRepo();
const historyStore = new BlobHistoryStore();
const pushSender = new FcmV1Sender();
const clock = new SystemClock();

function newRequestId(): string {
  return `r_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function errorResponse(err: unknown, requestId: string, context: InvocationContext, label: string): HttpResponseInit {
  if (err instanceof AppError) {
    return { status: err.httpStatus, jsonBody: fail(err, requestId) };
  }
  context.error(`unhandled error in ${label}`, toSafeErrorLog(err));
  const internal = new AppError("INTERNAL_ERROR", "unexpected error");
  return { status: internal.httpStatus, jsonBody: fail(internal, requestId) };
}

app.http("getGeofences", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v1/geofences",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo });
      const result = await getGeofences(
        { familyId: auth.familyId, ifNoneMatch: request.headers.get("if-none-match") },
        { geofenceConfigRepo, entitlementsRepo, usageRepo, clock },
      );
      if (result.notModified) {
        return { status: 304, headers: { ETag: result.etag } };
      }
      return {
        status: 200,
        headers: { ETag: result.etag },
        jsonBody: ok({ version: result.version, geofences: result.geofences }, result.features),
      };
    } catch (err) {
      return errorResponse(err, requestId, context, "getGeofences");
    }
  },
});

app.http("replaceGeofences", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "v1/geofences",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo });
      const body: unknown = await request.json().catch(() => ({}));
      const result = await replaceGeofences(
        { familyId: auth.familyId, role: auth.role, ifMatch: request.headers.get("if-match"), body },
        { geofenceConfigRepo, deviceRepo, familyRepo, entitlementsRepo, usageRepo, pushSender, clock },
      );
      return {
        status: 200,
        headers: { ETag: result.etag },
        jsonBody: ok({ version: result.version, geofences: result.geofences }, result.features),
      };
    } catch (err) {
      return errorResponse(err, requestId, context, "replaceGeofences");
    }
  },
});

app.http("reportGeofenceEvents", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/geofence-events",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo });
      const body: unknown = await request.json().catch(() => ({}));
      const result = await reportGeofenceEvents(
        {
          uid: auth.uid,
          familyId: auth.familyId,
          deviceId: request.headers.get("x-device-id"),
          body,
        },
        {
          deviceRepo,
          familyRepo,
          geofenceConfigRepo,
          idempotencyRepo,
          historyStore,
          usageRepo,
          entitlementsRepo,
          pushSender,
          clock,
        },
      );
      return {
        status: 200,
        jsonBody: ok(
          {
            accepted: result.accepted,
            duplicates: result.duplicates,
            deviceSettings: result.deviceSettings,
            geofenceEtag: result.geofenceEtag,
          },
          result.features,
        ),
      };
    } catch (err) {
      return errorResponse(err, requestId, context, "reportGeofenceEvents");
    }
  },
});
