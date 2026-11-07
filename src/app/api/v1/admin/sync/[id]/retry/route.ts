import { NextResponse, after } from "next/server";
import { z } from "zod";

import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertNotDemoActor } from "@/lib/authz/demo-guard";
import {
  assertSameOrigin,
  requireMasterApi,
  requireStepUp,
} from "@/lib/authz/guards";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { retrySyncJob, runSyncJob } from "@/lib/sync/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    await requireStepUp();
    const limit = await consumeRateLimit({
      key: `sync:retry:${master.userId}:${getClientIp(request)}`,
      limit: 5,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message:
              "Terlalu banyak permintaan sinkronisasi. Coba lagi sebentar.",
          },
          meta: { requestId },
        },
        { status: 429, headers: await getRateLimitHeaders(limit) },
      );
    }

    const { id } = paramsSchema.parse(await params);
    const job = await retrySyncJob({ id, actorId: master.userId });

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "SYNC_RETRIED",
      recordType: "SYNC_JOB",
      recordId: job.id,
      after: { previousJobId: id, dryRun: job.dryRun },
      requestId,
      source: "APP",
    });

    const actorId = master.userId;
    after(async () => {
      await runSyncJob(job.id);
      await recordAudit({
        actorId,
        actorRole: "MASTER_ADMIN",
        action: "SYNC_FINISHED",
        recordType: "SYNC_JOB",
        recordId: job.id,
        after: { dryRun: job.dryRun },
        requestId,
        source: "SYSTEM",
      });
    });

    return jsonOk(job, { requestId, status: 202 });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
