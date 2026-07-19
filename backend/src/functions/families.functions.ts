// specs/001 §3.1 `POST /api/v1/families`. Thin: parse -> authenticate -> domain -> envelope.
// No business logic here (excluded from mutation, no unit tests — integration tests later).

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { randomUUID } from "node:crypto";
import { authenticate } from "../http/authGuard";
import { ok, fail } from "../http/envelope";
import { AppError } from "../http/errors";
import { createFamily } from "../domain/family/createFamily";
import { createTokenVerifier } from "../adapters/auth/firebaseJoseVerifier";
import { TableUserRepo } from "../adapters/tables/usersTableRepo";
import { TableFamilyRepo } from "../adapters/tables/familiesTableRepo";
import { TableEntitlementsRepo } from "../adapters/tables/entitlementsTableRepo";
import { TableUsageRepo } from "../adapters/tables/usageTableRepo";
import { SystemClock } from "../adapters/support/systemClock";
import { CryptoIdGenerator } from "../adapters/support/cryptoIdGenerator";

const tokenVerifier = createTokenVerifier();
const userRepo = new TableUserRepo();
const familyRepo = new TableFamilyRepo();
const entitlementsRepo = new TableEntitlementsRepo();
const usageRepo = new TableUsageRepo();
const clock = new SystemClock();
const idGenerator = new CryptoIdGenerator();

function newRequestId(): string {
  return `r_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function errorResponse(err: unknown, requestId: string, context: InvocationContext): HttpResponseInit {
  if (err instanceof AppError) {
    return { status: err.httpStatus, jsonBody: fail(err, requestId) };
  }
  context.error("unhandled error in createFamily", err);
  const internal = new AppError("INTERNAL_ERROR", "unexpected error");
  return { status: internal.httpStatus, jsonBody: fail(internal, requestId) };
}

app.http("createFamily", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/families",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(
        request.headers.get("authorization"),
        { tokenVerifier, userRepo },
        { allowNoProfile: true },
      );
      const body: unknown = await request.json().catch(() => ({}));
      const result = await createFamily(
        { uid: auth.uid, familyId: auth.familyId, body },
        { familyRepo, userRepo, entitlementsRepo, usageRepo, idGenerator, clock },
      );
      return {
        status: 201,
        jsonBody: ok(
          { familyId: result.familyId, familyName: result.familyName, member: result.member },
          result.features,
        ),
      };
    } catch (err) {
      return errorResponse(err, requestId, context);
    }
  },
});
