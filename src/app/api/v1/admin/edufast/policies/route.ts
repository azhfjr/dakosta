import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertNotDemoActor } from "@/lib/authz/demo-guard";
import { assertSameOrigin, requireMasterApi } from "@/lib/authz/guards";
import {
  ensurePolicyInput,
  listPolicies,
  listPolicyEvents,
  saveDraftPolicy,
} from "@/lib/edufast/policy";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveSchema = z.object({
  policyId: z.string().uuid().optional(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  subThemes: z.array(z.string()).min(1),
  explanation: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await requireMasterApi();
    const [policies, events] = await Promise.all([
      listPolicies(),
      listPolicyEvents(20),
    ]);
    return jsonOk({ policies, events }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    assertNotDemoActor(master);

    const limit = await consumeRateLimit({
      key: `policy:save:${master.userId}:${getClientIp(request)}`,
      limit: 30,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return jsonError(
        Object.assign(new Error("Terlalu banyak perubahan kebijakan."), {
          code: "RATE_LIMITED",
          status: 429,
        }),
        requestId,
      );
    }

    const raw = await readJson<unknown>(request);
    ensurePolicyInput(raw);
    const body = saveSchema.parse(raw);
    const policy = await saveDraftPolicy({
      policyId: body.policyId,
      period: body.period,
      subThemes: body.subThemes,
      explanation: body.explanation ?? null,
      actorId: master.userId,
    });

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "EDUFAST_POLICY_SAVED",
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
