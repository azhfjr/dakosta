import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { getMapOverview, parseMapFiltersFromQuery } from "@/lib/map";
import { assertCapability } from "@/lib/rbac";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await getApiUser();
    assertCapability(user, "map:read");
    const filters = parseMapFiltersFromQuery(new URL(request.url).searchParams);
    const overview = await getMapOverview(user, filters);

    return jsonOk(
      {
        filters: overview.filters,
        points: overview.points,
        sites: overview.sites,
        totals: overview.totals,
        truncated: overview.truncated,
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
