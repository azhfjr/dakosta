import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit";
import { getRequestId, jsonError } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/authz/types";
import {
  parsePerformanceFilters,
  listPerformanceRows,
} from "@/lib/performance";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { renderPerformancePdf } from "@/lib/reports/performance-pdf";
import { assertCapability } from "@/lib/rbac";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);

  try {
    const user = await getApiUser();
    assertCapability(user, "performance:export");

    const limit = await consumeRateLimit({
      key: `report:performance:${user.id}:${getClientIp(request)}`,
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

    const filters = parsePerformanceFilters(url.searchParams);
    const { rows, summary } = await listPerformanceRows(user, filters);
    const pdf = await renderPerformancePdf({
      scopeLabel: user.scopeLabel,
      roleLabel: ROLE_LABELS[user.role] ?? user.role,
      filters,
      rows,
      summary,
      generatedAt: new Date(),
    });

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "EXPORT_PERFORMANCE_REPORT",
      recordType: "REPORT",
      recordId: filters.period.key,
      source: "API",
      requestId,
      after: {
        period: filters.period.key,
        branchId: filters.branchId,
        source: filters.source,
        status: filters.status,
        q: filters.q,
        rows: rows.length,
        approved: summary.approved,
        target: summary.target,
      },
    });

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        ...rateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="laporan-kinerja-${filters.period.key}.pdf"`,
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
