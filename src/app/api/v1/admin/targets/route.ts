import { NextResponse } from "next/server";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  assertSameOrigin,
  requireMasterApi,
  requireStepUp,
} from "@/lib/authz/guards";
import { monthKeyFor } from "@/lib/kpi/formulas";
import { consumeRateLimit, getClientIp, getRateLimitHeaders } from "@/lib/rate-limit";
import {
  createTarget,
  getTargetOverview,
  listTargetStakeholders,
} from "@/lib/targets";
import { targetCreateSchema, targetMonthSchema } from "@/lib/validation/target";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await requireMasterApi();
    const url = new URL(request.url);
    const rawMonth = url.searchParams.get("month");
    const month = targetMonthSchema.safeParse(rawMonth).success
      ? (rawMonth as string)
      : monthKeyFor();

    const [overview, stakeholders] = await Promise.all([
      getTargetOverview(month),
      listTargetStakeholders(),
    ]);

    return jsonOk({ overview, stakeholders }, { requestId });
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
      key: `target:create:${master.userId}:${getClientIp(request)}`,
      limit: 30,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Terlalu banyak perubahan target. Coba lagi sebentar.",
          },
          meta: { requestId },
        },
        { status: 429, headers: await getRateLimitHeaders(limit) },
      );
    }

    const body = targetCreateSchema.parse(await readJson(request));
    const target = await createTarget(
      {
        month: body.month,
        stakeholderId: body.stakeholderId ?? null,
        subTheme: body.subTheme ?? null,
        targetCount: body.targetCount,
        reportingUnit: body.reportingUnit ?? "konten",
      },
      master.userId,
    );

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "TARGET_CREATED",
      recordType: "KPI_TARGET",
      recordId: target.id,
      after: {
        month: body.month,
        stakeholderId: body.stakeholderId ?? null,
        subTheme: body.subTheme ?? null,
        targetCount: body.targetCount,
        reportingUnit: body.reportingUnit ?? "konten",
      },
      requestId,
      source: "APP",
    });

    return jsonOk(target, { requestId, status: 201 });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
