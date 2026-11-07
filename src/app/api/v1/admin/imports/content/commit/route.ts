import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  assertSameOrigin,
  requireMasterApi,
  requireStepUp,
} from "@/lib/authz/guards";
import { errors } from "@/lib/errors";
import {
  commitContentImport,
  contentImportResultsCsv,
} from "@/lib/imports/content";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  filename: z.string().trim().min(1).max(160),
  content: z.string().min(1),
  digest: z.string().trim().min(32).max(128),
  downloadResults: z.boolean().optional(),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    await requireStepUp();
    const user = await getApiUser();
    if (user.isDemo) {
      throw errors.forbidden("Akun demo tidak dapat mengimpor konten.");
    }

    const limit = await consumeRateLimit({
      key: `content-import:commit:${master.userId}:${getClientIp(request)}`,
      limit: 3,
      windowSeconds: 300,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message:
              "Batas impor konten tercapai. Coba lagi dalam beberapa menit.",
          },
          meta: { requestId },
        },
        { status: 429, headers: await getRateLimitHeaders(limit) },
      );
    }

    const body = inputSchema.parse(await readJson(request));
    const result = await commitContentImport({
      filename: body.filename,
      content: body.content,
      digest: body.digest,
      actor: user,
      requestId,
    });

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "CONTENT_IMPORT_COMMITTED",
      recordType: "CONTENT_IMPORT",
      after: {
        runId: result.runId,
        filename: result.filename,
        created: result.created,
        approved: result.approved,
        failed: result.failed,
        digest: result.digest,
      },
      requestId,
      source: "APP",
    });

    if (body.downloadResults) {
      return new Response(contentImportResultsCsv(result.rows), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition":
            'attachment; filename="hasil-impor-konten.csv"',
          "cache-control": "no-store",
        },
      });
    }

    return jsonOk(result, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
