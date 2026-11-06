import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertNotDemoActor } from "@/lib/authz/demo-guard";
import { assertSameOrigin, requireMasterApi } from "@/lib/authz/guards";
import { archivePolicy } from "@/lib/edufast/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({ policyId: z.string().uuid() });

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    assertNotDemoActor(master);
    const body = inputSchema.parse(await readJson(request));
    await archivePolicy({ policyId: body.policyId, actorId: master.userId });

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "EDUFAST_POLICY_ARCHIVED",
      recordType: "EDUFAST_POLICY",
      recordId: body.policyId,
      requestId,
      source: "APP",
    });

    return jsonOk({ ok: true }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
