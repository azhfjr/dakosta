import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { CONTENT_STATUSES, type ContentStatus } from "@/lib/content-status";
import { getApiUser, getApiUserWithRole } from "@/lib/session";
import { listSubmissions, saveSubmission } from "@/lib/submissions";
import { submissionInputSchema } from "@/lib/validation/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusSchema = z.enum(CONTENT_STATUSES);

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await getApiUser();
    const url = new URL(request.url);

    const statusParam = url.searchParams.get("status");
    let status: ContentStatus | undefined;
    if (statusParam) {
      const parsed = statusSchema.safeParse(statusParam);
      if (!parsed.success) {
        return jsonOk([], { requestId, meta: { ignoredStatus: statusParam } });
      }
      status = parsed.data;
    }

    const limitParam = Number(url.searchParams.get("limit") ?? "30");
    const limit = Number.isFinite(limitParam) ? limitParam : 30;

    const submissions = await listSubmissions(user, { status, limit });
    return jsonOk(submissions, { requestId, meta: { count: submissions.length } });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await getApiUserWithRole("CLIENT");
    const input = submissionInputSchema.parse(await readJson(request));
    const saved = await saveSubmission(user, input, requestId);

    return jsonOk(
      { submission: saved },
      {
        requestId,
        status: saved.created ? 201 : 200,
        meta: { action: input.action },
      },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
