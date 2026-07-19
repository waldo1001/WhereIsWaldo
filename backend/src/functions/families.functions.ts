// specs/001 §3.1-§3.6 `/api/v1/families/*`. Thin: parse -> authenticate -> domain -> envelope.
// No business logic here (excluded from mutation, no unit tests — integration tests later).

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { randomUUID } from "node:crypto";
import { authenticate } from "../http/authGuard";
import { ok, fail } from "../http/envelope";
import { AppError } from "../http/errors";
import { memberUserIdParamSchema, parseOrThrow } from "../http/validate";
import { createFamily } from "../domain/family/createFamily";
import { getMyFamily } from "../domain/family/getMyFamily";
import { createInvite } from "../domain/family/createInvite";
import { updateMember } from "../domain/family/updateMember";
import { removeMember } from "../domain/family/removeMember";
import { createTokenVerifier } from "../adapters/auth/firebaseJoseVerifier";
import { TableUserRepo } from "../adapters/tables/usersTableRepo";
import { TableFamilyRepo } from "../adapters/tables/familiesTableRepo";
import { TableEntitlementsRepo } from "../adapters/tables/entitlementsTableRepo";
import { TableUsageRepo } from "../adapters/tables/usageTableRepo";
import { TableDeviceRepo } from "../adapters/tables/devicesTableRepo";
import { TableInviteRepo } from "../adapters/tables/invitesTableRepo";
import { SystemClock } from "../adapters/support/systemClock";
import { CryptoIdGenerator } from "../adapters/support/cryptoIdGenerator";
import { CryptoInviteCodeGenerator } from "../adapters/support/cryptoInviteCodeGenerator";

const tokenVerifier = createTokenVerifier();
const userRepo = new TableUserRepo();
const familyRepo = new TableFamilyRepo();
const entitlementsRepo = new TableEntitlementsRepo();
const usageRepo = new TableUsageRepo();
const deviceRepo = new TableDeviceRepo();
const inviteRepo = new TableInviteRepo();
const clock = new SystemClock();
const idGenerator = new CryptoIdGenerator();
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
      return errorResponse(err, requestId, context, "createFamily");
    }
  },
});

app.http("getMyFamily", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v1/families/me",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo });
      const result = await getMyFamily(
        { uid: auth.uid, familyId: auth.familyId },
        { familyRepo, entitlementsRepo, usageRepo, clock },
      );
      return {
        status: 200,
        jsonBody: ok(
          {
            familyId: result.familyId,
            familyName: result.familyName,
            createdAt: result.createdAt,
            me: result.me,
            members: result.members,
          },
          result.features,
        ),
      };
    } catch (err) {
      return errorResponse(err, requestId, context, "getMyFamily");
    }
  },
});

app.http("createInvite", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/families/me/invites",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo });
      const body: unknown = await request.json().catch(() => ({}));
      const result = await createInvite(
        { uid: auth.uid, familyId: auth.familyId, role: auth.role, body },
        { inviteRepo, entitlementsRepo, usageRepo, inviteCodeGenerator, clock },
      );
      return {
        status: 201,
        jsonBody: ok(
          { inviteCode: result.inviteCode, role: result.role, expiresAt: result.expiresAt },
          result.features,
        ),
      };
    } catch (err) {
      return errorResponse(err, requestId, context, "createInvite");
    }
  },
});

app.http("updateMember", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "v1/families/me/members/{userId}",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo });
      const { userId: targetUserId } = parseOrThrow(memberUserIdParamSchema, { userId: request.params.userId });
      const body: unknown = await request.json().catch(() => ({}));
      const result = await updateMember(
        { uid: auth.uid, familyId: auth.familyId, role: auth.role, targetUserId, body },
        { familyRepo, userRepo, entitlementsRepo, usageRepo, clock },
      );
      return { status: 200, jsonBody: ok(result.member, result.features) };
    } catch (err) {
      return errorResponse(err, requestId, context, "updateMember");
    }
  },
});

app.http("removeMember", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "v1/families/me/members/{userId}",
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const requestId = newRequestId();
    try {
      const auth = await authenticate(request.headers.get("authorization"), { tokenVerifier, userRepo });
      const { userId: targetUserId } = parseOrThrow(memberUserIdParamSchema, { userId: request.params.userId });
      await removeMember(
        { uid: auth.uid, familyId: auth.familyId, role: auth.role, targetUserId },
        { familyRepo, userRepo, deviceRepo, usageRepo, clock },
      );
      return { status: 204 };
    } catch (err) {
      return errorResponse(err, requestId, context, "removeMember");
    }
  },
});
