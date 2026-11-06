import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertNotDemoActor } from "@/lib/authz/demo-guard";
import { assertSameOrigin, requireMasterApi } from "@/lib/authz/guards";
import { publishPolicy } from "@/lib/edufast/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  policyId: z.string().uuid(),
  explanation: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    assertNotDemoActor(master);
    const body = inputSchema.parse(await readJson(request));
    const policy = await publishPolicy({
      policyId: body.policyId,
      explanation: body.explanation,
      actorId: master.userId,
    });

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "EDUFAST_POLICY_PUBLISHED",
      recordType: "EDUFAST_POLICY",
      recordId: policy.id,
      after: { period: policy.period, version: policy.version },
      requestId,
      source: "APP",
    });

    return jsonOk(policy, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
