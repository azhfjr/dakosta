import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { assertNotDemoActor } from "@/lib/authz/demo-guard";
import { assertSameOrigin, requireMasterApi } from "@/lib/authz/guards";
import { previewImport } from "@/lib/imports/accounts";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  filename: z.string().trim().min(1).max(160),
  content: z.string().min(1),
  idempotencyKey: z.string().trim().max(120).optional(),
  policy: z.enum(["skip", "update", "upsert"]).optional(),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    assertNotDemoActor(master);

    const limit = await consumeRateLimit({
      key: `import:preview:${master.userId}:${getClientIp(request)}`,
      limit: 10,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return jsonError(
        Object.assign(new Error("Terlalu banyak pratinjau impor."), {
          code: "RATE_LIMITED",
          status: 429,
        }),
        requestId,
      );
    }

    const body = inputSchema.parse(await readJson(request));
    const preview = await previewImport({
      filename: body.filename,
      content: body.content,
      actorId: master.userId,
      idempotencyKey: body.idempotencyKey,
      policy: body.policy,
    });

    return jsonOk(preview, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
