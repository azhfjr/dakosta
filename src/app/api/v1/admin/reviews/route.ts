import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import {
  listReviewQueue,
  reviewDecisionSchema,
  reviewSubmission,
  type ReviewQueueFilters,
} from "@/lib/review";
import { getApiUserWithRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const queueQuerySchema = z.object({
  status: z.enum(["ALL", "SUBMITTED", "IN_REVIEW"]).default("ALL"),
  stakeholderId: z.string().uuid().optional(),
  themeId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(15),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const admin = await getApiUserWithRole("ADMIN");
    const params = new URL(request.url).searchParams;

    const parsed = queueQuerySchema.parse({
      status: params.get("status") ?? undefined,
      stakeholderId: params.get("stakeholderId") ?? undefined,
      themeId: params.get("themeId") ?? undefined,
      search: params.get("search")?.trim() || undefined,
      page: params.get("page") ?? undefined,
      pageSize: params.get("pageSize") ?? undefined,
    });

    const filters: ReviewQueueFilters = parsed;
    const queue = await listReviewQueue(admin, filters);

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
    const admin = await getApiUserWithRole("ADMIN");
    const input = reviewDecisionSchema.parse(await readJson(request));
    const decision = await reviewSubmission(admin, input, requestId);

    return jsonOk(decision, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
