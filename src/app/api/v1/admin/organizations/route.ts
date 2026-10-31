import { NextResponse } from "next/server";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertSameOrigin, requireMasterApi } from "@/lib/authz/guards";
import {
  createOrganization,
  createOrganizationInputSchema,
} from "@/lib/hierarchy-admin";
import { consumeRateLimit, getClientIp, getRateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    const limit = await consumeRateLimit({
      key: `hierarchy:organization:${master.userId}:${getClientIp(request)}`,
      limit: 60,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: { code: "RATE_LIMITED", message: "Terlalu banyak perubahan. Coba lagi sebentar." },
          meta: { requestId },
        },
        { status: 429, headers: await getRateLimitHeaders(limit) },
      );
    }

    const body = createOrganizationInputSchema.parse(await readJson(request));
    const organization = await createOrganization(body);

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "ORGANIZATION_CREATED",
      recordType: "ORGANIZATION",
      recordId: organization.id,
      after: {
        name: body.name,
        organizationType: body.organizationType,
        faskesClass: body.faskesClass ?? null,
        faskesCode: body.faskesCode ?? null,
        status: body.status,
      },
      branchId: body.branchOfficeId,
      organizationId: organization.id,
      requestId,
      source: "API",
    });

    return jsonOk(organization, { requestId, status: 201 });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
