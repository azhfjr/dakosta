import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { requireMasterApi, requireStepUp, assertSameOrigin } from "@/lib/authz/guards";
import {
  createAccount,
  createAccountInputSchema,
  listAccounts,
  listScopeOptions,
} from "@/lib/accounts";
import { consumeRateLimit, getClientIp, getRateLimitHeaders } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await requireMasterApi();
    const [users, options] = await Promise.all([listAccounts(), listScopeOptions()]);
    return jsonOk({ users, options }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    await requireStepUp();
    const limit = await consumeRateLimit({
      key: `account:create:${master.userId}:${getClientIp(request)}`,
      limit: 20,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Terlalu banyak pembuatan akun. Coba lagi sebentar.",
          },
          meta: { requestId },
        },
        { status: 429, headers: await getRateLimitHeaders(limit) },
      );
    }

    const body = createAccountInputSchema.parse(await readJson(request));
    const account = await createAccount(body);

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "ACCOUNT_CREATED",
      recordType: "USER",
      recordId: account.userId,
      after: {
        email: account.email,
        role: body.role,
        regionalOfficeId: body.regionalOfficeId ?? null,
        branchOfficeId: body.branchOfficeId ?? null,
        organizationId: body.organizationId ?? null,
      },
      requestId,
      source: "APP",
    });

    return jsonOk(account, { requestId, status: 201 });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
