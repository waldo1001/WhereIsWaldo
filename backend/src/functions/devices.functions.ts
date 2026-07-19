// specs/001 §4.1 `POST /api/v1/devices`. Thin: parse -> authenticate -> domain -> envelope.
// No business logic here (excluded from mutation, no unit tests — integration tests later).

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { randomUUID } from "node:crypto";
import { authenticate } from "../http/authGuard";
import { ok, fail } from "../http/envelope";
import { AppError } from "../http/errors";
import { registerDevice } from "../domain/device/registerDevice";
import { createTokenVerifier } from "../adapters/auth/firebaseJoseVerifier";
import { TableUserRepo } from "../adapters/tables/usersTableRepo";
import { TableDeviceRepo } from "../adapters/tables/devicesTableRepo";
import { TableEntitlementsRepo } from "../adapters/tables/entitlementsTableRepo";
import { SystemClock } from "../adapters/support/systemClock";

const tokenVerifier = createTokenVerifier();
const userRepo = new TableUserRepo();
const deviceRepo = new TableDeviceRepo();
const entitlementsRepo = new TableEntitlementsRepo();
const clock = new SystemClock();

function newRequestId(): string {
  return `r_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function errorResponse(err: unknown, requestId: string, context: InvocationContext): HttpResponseInit {
  if (err instanceof AppError) {
    return { status: err.httpStatus, jsonBody: fail(err, requestId) };
  }
  context.error("unhandled error in registerDevice", err);
  const internal = new AppError("INTERNAL_ERROR", "unexpected error");
  return { status: internal.httpStatus, jsonBody: fail(internal, requestId) };
}

app.http("registerDevice", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/devices",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo });
      const body: unknown = await request.json().catch(() => ({}));
      const result = await registerDevice(
        { uid: auth.uid, familyId: auth.familyId, body },
        { deviceRepo, entitlementsRepo, clock },
      );
      return {
        status: result.created ? 201 : 200,
        jsonBody: ok(result.device, result.features),
      };
    } catch (err) {
      return errorResponse(err, requestId, context);
    }
  },
});
