import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { requireMasterApi } from "@/lib/authz/guards";
import { listTargetStakeholders } from "@/lib/targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await requireMasterApi();
    const stakeholders = await listTargetStakeholders();
    return jsonOk({ stakeholders }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
