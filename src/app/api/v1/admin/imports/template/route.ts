import {
  templateCsv,
  ACCOUNT_IMPORT_HEADERS,
} from "@/lib/imports/accounts";
import { requireMasterApi } from "@/lib/authz/guards";
import { getRequestId, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await requireMasterApi();
    return new Response(templateCsv(), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="template-impor-akun.csv"',
        "x-import-headers": ACCOUNT_IMPORT_HEADERS.join(","),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
