// specs/001 §12.1 `POST /api/v1/groups`, §12.2 `GET /api/v1/groups`, §12.3
// `GET /api/v1/groups/{groupId}`, §12.6 `POST /api/v1/groups/join`. Thin: parse ->
// authenticate -> domain -> envelope. No business logic here (excluded from mutation, no
// unit tests — integration tests later). Group controls (§12.4-§12.5/§12.7-§12.9, B10) and
// the group live map (§12.10, B11) are out of this task's scope.

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { randomUUID } from "node:crypto";
import { authenticate } from "../http/authGuard";
import { ok, fail } from "../http/envelope";
import { AppError } from "../http/errors";
import { groupIdParamSchema, parseOrThrow } from "../http/validate";
import { createGroup } from "../domain/group/createGroup";
import { listGroups } from "../domain/group/listGroups";
import { getGroupDetail } from "../domain/group/getGroupDetail";
import { joinGroup } from "../domain/group/joinGroup";
import { createTokenVerifier } from "../adapters/auth/firebaseJoseVerifier";
import { TableUserRepo } from "../adapters/tables/usersTableRepo";
import { TableGroupRepo } from "../adapters/tables/groupsTableRepo";
import { TableGroupCodeRepo } from "../adapters/tables/groupCodesTableRepo";
import { TableGroupExpiryRepo } from "../adapters/tables/groupExpiryTableRepo";
import { TableEntitlementsRepo } from "../adapters/tables/entitlementsTableRepo";
import { TableUsageRepo } from "../adapters/tables/usageTableRepo";
import { SystemClock } from "../adapters/support/systemClock";
import { CryptoIdGenerator } from "../adapters/support/cryptoIdGenerator";
import { CryptoInviteCodeGenerator } from "../adapters/support/cryptoInviteCodeGenerator";

const tokenVerifier = createTokenVerifier();
const userRepo = new TableUserRepo();
const groupRepo = new TableGroupRepo();
const groupCodeRepo = new TableGroupCodeRepo();
const groupExpiryRepo = new TableGroupExpiryRepo();
const entitlementsRepo = new TableEntitlementsRepo();
const usageRepo = new TableUsageRepo();
const clock = new SystemClock();
const idGenerator = new CryptoIdGenerator();
// Same 8-char Crockford format/normalization as family invite codes (005 §1, 001 §1.4).
const inviteCodeGenerator = new CryptoInviteCodeGenerator();

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

app.http("createGroup", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/groups",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(
        request.headers.get("authorization"),
        { tokenVerifier, userRepo },
        { allowNoProfile: true },
      );
      const body: unknown = await request.json().catch(() => ({}));
      const result = await createGroup(
        { uid: auth.uid, body },
        { groupRepo, groupCodeRepo, groupExpiryRepo, userRepo, entitlementsRepo, usageRepo, idGenerator, inviteCodeGenerator, clock },
      );
      const { features, ...data } = result;
      return { status: 201, jsonBody: ok(data, features) };
    } catch (err) {
      return errorResponse(err, requestId, context, "createGroup");
    }
  },
});

app.http("listGroups", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v1/groups",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo });
      const result = await listGroups(
        { uid: auth.uid, familyId: auth.familyId },
        { groupRepo, userRepo, entitlementsRepo, usageRepo, clock },
      );
      return { status: 200, jsonBody: ok({ groups: result.groups }, result.features) };
    } catch (err) {
      return errorResponse(err, requestId, context, "listGroups");
    }
  },
});

app.http("getGroupDetail", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v1/groups/{groupId}",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo });
      const { groupId } = parseOrThrow(groupIdParamSchema, { groupId: request.params.groupId });
      const result = await getGroupDetail(
        { uid: auth.uid, familyId: auth.familyId, groupId },
        { groupRepo, entitlementsRepo, usageRepo, clock },
      );
      const { features, ...data } = result;
      return { status: 200, jsonBody: ok(data, features) };
    } catch (err) {
      return errorResponse(err, requestId, context, "getGroupDetail");
    }
  },
});

app.http("joinGroup", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/groups/join",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(
        request.headers.get("authorization"),
        { tokenVerifier, userRepo },
        { allowNoProfile: true },
      );
      const body: unknown = await request.json().catch(() => ({}));
      const result = await joinGroup(
        { uid: auth.uid, body },
        { groupRepo, groupCodeRepo, userRepo, entitlementsRepo, usageRepo, clock },
      );
      const { features, ...data } = result;
      return { status: 200, jsonBody: ok(data, features) };
    } catch (err) {
      return errorResponse(err, requestId, context, "joinGroup");
    }
  },
});
