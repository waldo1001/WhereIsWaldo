// specs/001 §5.3 `GET /api/v1/locations/history`, §7.4 `GET /api/v1/geofence-events` (the
// history READ). Thin: parse -> authenticate -> domain -> envelope. No business logic here
// (excluded from mutation, no unit tests — integration tests later).
//
// COORDINATION: `POST /api/v1/geofence-events` (§7.3, event reporting) is owned by task B5
// and registered under a different function name/handler — Azure Functions v4 allows
// separate `app.http` registrations per method on the same route, so this file registers
// the GET only and must not be edited to add the POST.

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { randomUUID } from "node:crypto";
import { authenticate } from "../http/authGuard";
import { ok, fail } from "../http/envelope";
import { AppError } from "../http/errors";
import { getLocationHistory } from "../domain/history/getLocationHistory";
import { getGeofenceEventHistory } from "../domain/history/getGeofenceEventHistory";
import { createTokenVerifier } from "../adapters/auth/firebaseJoseVerifier";
import { TableUserRepo } from "../adapters/tables/usersTableRepo";
import { TableEntitlementsRepo } from "../adapters/tables/entitlementsTableRepo";
import { TableUsageRepo } from "../adapters/tables/usageTableRepo";
import { BlobHistoryStore } from "../adapters/blobs/historyBlobStore";
import { SystemClock } from "../adapters/support/systemClock";

const tokenVerifier = createTokenVerifier();
const userRepo = new TableUserRepo();
const entitlementsRepo = new TableEntitlementsRepo();
const usageRepo = new TableUsageRepo();
const historyStore = new BlobHistoryStore();
const clock = new SystemClock();

function newRequestId(): string {
  return `r_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function errorResponse(err: unknown, requestId: string, context: InvocationContext, label: string): HttpResponseInit {
  if (err instanceof AppError) {
    return { status: err.httpStatus, jsonBody: fail(err, requestId) };
  }
  context.error(`unhandled error in ${label}`, err);
  const internal = new AppError("INTERNAL_ERROR", "unexpected error");
  return { status: internal.httpStatus, jsonBody: fail(internal, requestId) };
}

function queryToObject(request: HttpRequest): Record<string, string> {
  return Object.fromEntries(request.query.entries());
}

app.http("getLocationHistory", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v1/locations/history",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo, usageRepo, clock });
      const result = await getLocationHistory(
        { familyId: auth.familyId, query: queryToObject(request) },
        { historyStore, entitlementsRepo, clock },
      );
      return {
        status: 200,
        jsonBody: ok({ points: result.points, nextCursor: result.nextCursor }, result.features),
      };
    } catch (err) {
      return errorResponse(err, requestId, context, "getLocationHistory");
    }
  },
});

app.http("getGeofenceEventHistory", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v1/geofence-events",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo, usageRepo, clock });
      const result = await getGeofenceEventHistory(
        { familyId: auth.familyId, query: queryToObject(request) },
        { historyStore, entitlementsRepo, clock },
      );
      return {
        status: 200,
        jsonBody: ok({ events: result.events, nextCursor: result.nextCursor }, result.features),
      };
    } catch (err) {
      return errorResponse(err, requestId, context, "getGeofenceEventHistory");
    }
  },
});
