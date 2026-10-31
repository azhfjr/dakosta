import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit";
import { getRequestId, jsonError } from "@/lib/api";
import { parseOrgSources } from "@/lib/analytics/source";
import { parseKpiFiltersFromQuery } from "@/lib/kpi/sql";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { getAchievementReport } from "@/lib/reports/achievement";
import { renderAchievementPdf } from "@/lib/reports/achievement-pdf";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);

  try {
    const user = await getApiUser();
    const limit = await consumeRateLimit({
      key: `report:achievement:${user.id}:${getClientIp(request)}`,
      limit: 8,
      windowSeconds: 60,
    });
    const rateHeaders = await getRateLimitHeaders(limit);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Terlalu banyak permintaan laporan. Coba lagi sebentar.",
          },
          meta: { requestId },
        },
        { status: 429, headers: rateHeaders },
      );
    }

    const filters = {
      ...parseKpiFiltersFromQuery(url.searchParams),
      sources: parseOrgSources(url.searchParams),
    };
    const report = await getAchievementReport(user, filters);
    const pdf = await renderAchievementPdf(report);

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "EXPORT_ACHIEVEMENT_REPORT",
      recordType: "REPORT",
      recordId: report.month,
      source: "API",
      requestId,
      after: {
        month: report.month,
        sources: filters.sources,
        stakeholderId: filters.stakeholderId,
        subTheme: filters.subTheme,
        approved: report.totals.approved,
      },
    });

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        ...rateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="laporan-pencapaian-${report.month}.pdf"`,
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
