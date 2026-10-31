import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import {
  assertSameOrigin,
  requireMasterApi,
  requireStepUp,
} from "@/lib/authz/guards";
import { revokeSubmission } from "@/lib/review";
import { toSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = toSessionUser(await requireMasterApi());
    await requireStepUp();
    const { id } = await context.params;
    const input = inputSchema.parse(await readJson(request));
    const result = await revokeSubmission(
      master,
      { submissionId: id, reason: input.reason },
      requestId,
    );
    return jsonOk(result, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
