import { z } from "zod";

import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { requireMasterApi } from "@/lib/authz/guards";
import { getSyncJob } from "@/lib/sync/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    await requireMasterApi();
    const { id } = paramsSchema.parse(await params);
    const job = await getSyncJob(id);
    return jsonOk(job, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
