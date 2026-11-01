import { getRequestId, jsonError } from "@/lib/api";
import { requireMasterApi } from "@/lib/authz/guards";
import {
  CONTENT_IMPORT_HEADERS,
  contentTemplateCsv,
} from "@/lib/imports/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await requireMasterApi();
    return new Response(contentTemplateCsv(), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition":
          'attachment; filename="template-impor-konten.csv"',
        "x-import-headers": CONTENT_IMPORT_HEADERS.join(","),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
