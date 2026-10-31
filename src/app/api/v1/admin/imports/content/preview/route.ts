import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { assertSameOrigin, requireMasterApi } from "@/lib/authz/guards";
import { errors } from "@/lib/errors";
import { previewContentImport } from "@/lib/imports/content";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  filename: z.string().trim().min(1).max(160),
  content: z.string().min(1),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    const user = await getApiUser();
    if (user.isDemo) {
      throw errors.forbidden("Akun demo tidak dapat mengimpor konten.");
    }

    const limit = await consumeRateLimit({
      key: `content-import:preview:${master.userId}:${getClientIp(request)}`,
      limit: 12,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return jsonError(errors.rateLimited(), requestId);
    }

    const body = inputSchema.parse(await readJson(request));
    const preview = await previewContentImport({
      filename: body.filename,
      content: body.content,
    });
    return jsonOk(preview, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
