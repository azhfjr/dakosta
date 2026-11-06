import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertNotDemoActor } from "@/lib/authz/demo-guard";
import { assertSameOrigin, requireMasterApi } from "@/lib/authz/guards";
import { copyPreviousPolicy } from "@/lib/edufast/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    assertNotDemoActor(master);
    const body = inputSchema.parse(await readJson(request));
    const policy = await copyPreviousPolicy({
      period: body.period,
      actorId: master.userId,
    });

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "EDUFAST_POLICY_COPIED",
      recordType: "EDUFAST_POLICY",
      recordId: policy.id,
      after: { period: policy.period, subThemes: policy.subThemes },
      requestId,
      source: "APP",
    });

    return jsonOk(policy, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
