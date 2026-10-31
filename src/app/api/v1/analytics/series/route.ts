import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import {
  getDashboardOverview,
  parseKpiFiltersFromQuery,
} from "@/lib/kpi/sql";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await getApiUser();
    const filters = parseKpiFiltersFromQuery(new URL(request.url).searchParams);
    const overview = await getDashboardOverview(user, filters);

    return jsonOk(
      {
        filters: overview.filters,
        period: overview.period,
        approved: overview.approved,
        previousApproved: overview.previousApproved,
        growth: overview.growth,
        statusCounts: overview.statusCounts,
        trend: overview.trend,
        themes: overview.themes,
        stakeholders: overview.stakeholders,
        generatedAt: overview.generatedAt,
      },
      {
        requestId,
        meta: {
          role: user.role,
          filters,
          generatedAt: overview.generatedAt,
        },
      },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
