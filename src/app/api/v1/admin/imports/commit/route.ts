import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import {
  assertSameOrigin,
  requireMasterApi,
  requireStepUp,
} from "@/lib/authz/guards";
import { assertDemoCannotManageAccounts } from "@/lib/authz/demo-guard";
import { commitImport, importResultsCsv } from "@/lib/imports/accounts";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  importId: z.string().uuid(),
  downloadResults: z.boolean().optional(),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const master = await requireMasterApi();
    await assertDemoCannotManageAccounts();
    await requireStepUp();

    const limit = await consumeRateLimit({
      key: `import:commit:${master.userId}:${getClientIp(request)}`,
      limit: 5,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return jsonError(
        Object.assign(new Error("Terlalu banyak eksekusi impor."), {
          code: "RATE_LIMITED",
          status: 429,
        }),
        requestId,
      );
    }

    const body = inputSchema.parse(await readJson(request));
    const result = await commitImport({
      importId: body.importId,
      actorId: master.userId,
    });

    await recordAudit({
      actorId: master.userId,
      actorRole: master.role,
      action: "ACCOUNT_IMPORT_COMMITTED",
      recordType: "ACCOUNT_IMPORT",
      recordId: result.importId,
      after: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      },
      requestId,
      source: "IMPORT",
    });

    if (body.downloadResults) {
      return new Response(importResultsCsv(result.rows), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="hasil-impor-akun.csv"',
          "cache-control": "no-store",
        },
      });
    }

    return jsonOk(result, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
