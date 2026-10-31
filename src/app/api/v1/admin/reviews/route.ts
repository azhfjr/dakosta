import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { assertSameOrigin, requireApiRole } from "@/lib/authz/guards";
import { toSessionUser } from "@/lib/session";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  listReviewQueue,
  reviewDecisionSchema,
  reviewSubmission,
  type ReviewQueueFilters,
} from "@/lib/review";
import { SUB_THEMES } from "@/lib/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const queueQuerySchema = z.object({
  status: z.enum(["ALL", "SUBMITTED", "RESUBMITTED", "IN_REVIEW"]).default("ALL"),
  stakeholderId: z.string().uuid().optional(),
  subTheme: z.enum(SUB_THEMES).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(15),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const reviewer = toSessionUser(
      await requireApiRole("MASTER_ADMIN", "BRANCH_ADMIN"),
    );
    const params = new URL(request.url).searchParams;

    const parsed = queueQuerySchema.parse({
      status: params.get("status") ?? undefined,
      stakeholderId: params.get("stakeholderId") ?? undefined,
      subTheme: params.get("subTheme") ?? undefined,
      search: params.get("search")?.trim() || undefined,
      page: params.get("page") ?? undefined,
      pageSize: params.get("pageSize") ?? undefined,
    });

    const filters: ReviewQueueFilters = parsed;
    const queue = await listReviewQueue(reviewer, filters);

    return jsonOk(queue, {
      requestId,
      meta: { count: queue.items.length, total: queue.total },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const reviewer = toSessionUser(
      await requireApiRole("MASTER_ADMIN", "BRANCH_ADMIN"),
    );

    const limit = await consumeRateLimit({
      key: `review:${reviewer.id}:${getClientIp(request)}`,
      limit: 60,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return jsonError(
        Object.assign(new Error("Terlalu banyak keputusan dalam waktu singkat."), {
          code: "RATE_LIMITED",
          status: 429,
        }),
        requestId,
      );
    }

    const input = reviewDecisionSchema.parse(await readJson(request));
    const decision = await reviewSubmission(reviewer, input, requestId);

    return jsonOk(decision, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
