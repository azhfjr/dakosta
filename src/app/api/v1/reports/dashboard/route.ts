import { NextResponse } from "next/server";

import {
  getDashboardFilteredUncached,
  getDashboardSummaryUncached,
} from "@/lib/analytics/dashboard-overview";
import { recordAudit } from "@/lib/audit";
import { ROLE_LABELS } from "@/lib/authz/types";
import { getRequestId, jsonError } from "@/lib/api";
import { parseBranchSelection } from "@/lib/filters/branch-selection";
import type { FilterParams } from "@/lib/filters/query";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import {
  dashboardExportFilename,
  renderDashboardPdf,
} from "@/lib/reports/dashboard-pdf";
import { infographicExportFilename } from "@/lib/reports/infographic";
import { assertCapability } from "@/lib/rbac";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await getApiUser();
    assertCapability(user, "export:read");

    const limit = await consumeRateLimit({
      key: `report:dashboard:${user.id}:${getClientIp(request)}`,
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

    const url = new URL(request.url);
    const format =
      url.searchParams.get("format") === "infographic" ? "infographic" : "pdf";
    const params: FilterParams = {
      cabang: url.searchParams.getAll("cabang"),
    };

    const summary = await getDashboardSummaryUncached(user);
    const selection = parseBranchSelection(
      params,
      summary.branches.map((branch) => branch.id),
    );
    const filtered = await getDashboardFilteredUncached(user, selection);

    const pdf = await renderDashboardPdf({
      scopeLabel: user.scopeLabel,
      roleLabel: ROLE_LABELS[user.role] ?? user.role,
      selection,
      summary,
      filtered,
      generatedAt: new Date(),
    });

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action:
        format === "infographic"
          ? "EXPORT_DASHBOARD_INFOGRAPHIC"
          : "EXPORT_DASHBOARD_REPORT",
      recordType: "REPORT",
      recordId: "dashboard",
      source: "API",
      requestId,
      after: {
        format,
        mode: selection.mode,
        branches: selection.ids.length,
        totalApproved: summary.totalApproved,
        rankingRows: Object.values(filtered.rankings).reduce(
          (total, rows) => total + rows.length,
          0,
        ),
        themes: filtered.nonEdufastThemes.length,
      },
    });

    // Both formats ship the same one-page PDF; the client rasterises the
    // infographic at 300 DPI so pixels and print never diverge.
    const pdfFilename = dashboardExportFilename(user.role);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        ...rateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFilename}"`,
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        "X-Report-Format": format,
        "X-Infographic-Filename": infographicExportFilename(user.role),
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
