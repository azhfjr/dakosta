import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { assertNotDemoActor } from "@/lib/authz/demo-guard";
import { assertSameOrigin, requireApiRole } from "@/lib/authz/guards";
import { guardRateLimit } from "@/lib/rate-limit";
import { toSessionUser } from "@/lib/session";
import { startReview } from "@/lib/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({ submissionId: z.string().uuid() });

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const reviewer = toSessionUser(
      await requireApiRole("MASTER_ADMIN", "BRANCH_ADMIN"),
    );
    assertNotDemoActor(reviewer);
    await guardRateLimit(request, "mutation", "review-start");
    const input = inputSchema.parse(await readJson(request));
    const result = await startReview(reviewer, input.submissionId, requestId);
    return jsonOk(result, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
