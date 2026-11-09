import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit";
import { getRequestId, jsonError } from "@/lib/api";
import { listAnalyticsContents } from "@/lib/analytics/content-table";
import { ROLE_LABELS } from "@/lib/authz/types";
import {
  parseKontenFilters,
  toAnalyticsFilters,
  type KontenMode,
} from "@/lib/filters/konten";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { assertCapability } from "@/lib/rbac";
import {
  CONTENT_REPORT_ROW_CAP,
  renderContentReportPdf,
} from "@/lib/reports/content-pdf";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function modeOf(searchParams: URLSearchParams): KontenMode {
  return searchParams.get("mode") === "approved" ? "approved" : "all";
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);

  try {
    const user = await getApiUser();
    assertCapability(user, "export:read");

    const limit = await consumeRateLimit({
      key: `report:contents:${user.id}:${getClientIp(request)}`,
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

    const filters = parseKontenFilters(
      Object.fromEntries(url.searchParams),
      modeOf(url.searchParams),
    );
    const data = await listAnalyticsContents(user, {
      ...toAnalyticsFilters(filters),
      page: 1,
      pageSize: CONTENT_REPORT_ROW_CAP,
    });

    const pdf = await renderContentReportPdf({
      scopeLabel: user.scopeLabel,
      roleLabel: ROLE_LABELS[user.role] ?? user.role,
      role: user.role,
      filters,
      rows: data.rows,
      total: data.total,
      generatedAt: new Date(),
    });

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "EXPORT_CONTENT_REPORT",
      recordType: "REPORT",
      recordId: "detail-konten",
      source: "API",
      requestId,
      after: {
        mode: filters.mode,
        status: filters.status,
        mainTheme: filters.mainTheme,
        subTheme: filters.subTheme,
        platform: filters.platform,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        search: filters.search,
        rows: data.rows.length,
        total: data.total,
      },
    });

    const day = new Date().toISOString().slice(0, 10);
    const filename = `detail-konten-${user.role.toLowerCase()}-${day}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        ...rateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
