import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import {
  getDashboardOverview,
  parseKpiFiltersFromQuery,
} from "@/lib/kpi/sql";
import { getApiUserWithRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const client = await getApiUserWithRole("CLIENT");
    const filters = parseKpiFiltersFromQuery(new URL(request.url).searchParams);
    const overview = await getDashboardOverview(client, filters);

    return jsonOk(overview, {
      requestId,
      meta: {
        role: "CLIENT",
        filters,
        generatedAt: overview.generatedAt,
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
