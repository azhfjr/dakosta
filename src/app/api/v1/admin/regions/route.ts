import { NextResponse } from "next/server";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertSameOrigin, requireMasterApi } from "@/lib/authz/guards";
import { createRegion, createRegionInputSchema } from "@/lib/hierarchy-admin";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    const limit = await consumeRateLimit({
      key: `hierarchy:region:${master.userId}:${getClientIp(request)}`,
      limit: 30,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Terlalu banyak perubahan. Coba lagi sebentar.",
          },
          meta: { requestId },
        },
        { status: 429, headers: await getRateLimitHeaders(limit) },
      );
    }

    const body = createRegionInputSchema.parse(await readJson(request));
    const region = await createRegion(body);

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "REGION_CREATED",
      recordType: "REGION",
      recordId: region.id,
      after: {
        code: body.code.toUpperCase(),
        name: body.name,
        status: body.status,
      },
      regionId: region.id,
      requestId,
      source: "API",
    });

    return jsonOk(region, { requestId, status: 201 });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
