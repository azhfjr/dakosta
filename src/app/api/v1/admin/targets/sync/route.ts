import { NextResponse } from "next/server";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  assertSameOrigin,
  requireMasterApi,
  requireStepUp,
} from "@/lib/authz/guards";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { syncTargets } from "@/lib/targets/sync";
import { targetSyncSchema } from "@/lib/validation/target";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    await requireStepUp();
    const limit = await consumeRateLimit({
      key: `target:sync:${master.userId}:${getClientIp(request)}`,
      limit: 6,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Terlalu banyak sinkronisasi target. Coba lagi sebentar.",
          },
          meta: { requestId },
        },
        { status: 429, headers: await getRateLimitHeaders(limit) },
      );
    }

    const body = targetSyncSchema.parse(await readJson(request));
    const result = await syncTargets({
      month: body.month,
      entries: body.entries,
      actorId: master.userId,
    });

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "TARGET_SYNCED",
      recordType: "KPI_TARGET",
      after: {
        month: result.month,
        created: result.created,
        updated: result.updated,
        entries: body.entries,
        perSource: result.perSource,
      },
      requestId,
      source: "APP",
    });

    return jsonOk(result, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
