import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  assertSameOrigin,
  requireMasterApi,
  requireStepUp,
} from "@/lib/authz/guards";
import {
  findAccount,
  resetAccountPassword,
  revokeUserSessions,
  updateAccount,
  updateAccountInputSchema,
} from "@/lib/accounts";
import { errors } from "@/lib/errors";
import { guardRateLimit } from "@/lib/rate-limit";
import { parseUuidParam } from "@/lib/validation/params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    await requireStepUp();
    const { id } = await context.params;
    await guardRateLimit(request, "mutation", "user-update");
    const accountId = parseUuidParam(id, "ID pengguna");
    const before = await findAccount(accountId);
    if (!before) {
      throw errors.notFound("Akun tidak ditemukan.");
    }

    const body = updateAccountInputSchema.parse(await readJson(request));
    await updateAccount(master.userId, accountId, body);

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "ACCOUNT_UPDATED",
      recordType: "USER",
      recordId: accountId,
      before: {
        role: before.role,
        status: before.status,
        regionalOfficeId: before.regionalOfficeId,
        branchOfficeId: before.branchOfficeId,
        organizationId: before.organizationId,
      },
      after: body as Record<string, unknown>,
      requestId,
    });

    return jsonOk({ id: accountId }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    await requireStepUp();
    const { id } = await context.params;
    await guardRateLimit(request, "mutation", "user-actions");
    const accountId = parseUuidParam(id, "ID pengguna");
    const body = (await readJson(request).catch(() => ({}))) as {
      action?: string;
    };

    if (body.action === "reset-password") {
      const result = await resetAccountPassword(accountId, master.userId);
      await recordAudit({
        actorId: master.userId,
        actorRole: master.role,
        action: "ACCOUNT_PASSWORD_RESET",
        recordType: "USER",
        recordId: accountId,
        after: { mustChangePassword: true, sessionsRevoked: true },
        requestId,
      });
      return jsonOk(result, { requestId });
    }

    if (body.action === "revoke-sessions") {
      const revoked = await revokeUserSessions(accountId);
      await recordAudit({
        actorId: master.userId,
        actorRole: master.role,
        action: "ACCOUNT_SESSIONS_REVOKED",
        recordType: "USER",
        recordId: accountId,
        after: { revoked },
        requestId,
      });
      return jsonOk({ revoked }, { requestId });
    }

    return jsonError(
      Object.assign(new Error("Aksi tidak dikenal."), {
        code: "INVALID_ACTION",
        status: 400,
      }),
      requestId,
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
