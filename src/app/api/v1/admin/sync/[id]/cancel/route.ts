import { z } from "zod";

import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertNotDemoActor } from "@/lib/authz/demo-guard";
import { assertSameOrigin, requireMasterApi } from "@/lib/authz/guards";
import { cancelSyncJob } from "@/lib/sync/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    assertNotDemoActor(master);
    const { id } = paramsSchema.parse(await params);
    const job = await cancelSyncJob(id);

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "SYNC_CANCEL_REQUESTED",
      recordType: "SYNC_JOB",
      recordId: job.id,
      after: { status: job.status },
      requestId,
      source: "APP",
    });

    return jsonOk(job, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
