import { getRequestId, jsonError } from "@/lib/api";
import { requireMasterApi } from "@/lib/authz/guards";
import {
  ACCOUNT_IMPORT_HEADERS,
  exampleAccountCsv,
} from "@/lib/imports/accounts";
import {
  CONTENT_IMPORT_HEADERS,
  CONTENT_IMPORT_OPTIONAL_HEADERS,
  contentExampleCsv,
} from "@/lib/imports/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await requireMasterApi();
    const kind = new URL(request.url).searchParams.get("kind") ?? "account";

    const { body, filename, headers } =
      kind === "content"
        ? {
            body: contentExampleCsv(),
            filename: "contoh_impor_konten.csv",
            headers: [
              ...CONTENT_IMPORT_HEADERS,
              ...CONTENT_IMPORT_OPTIONAL_HEADERS,
            ],
          }
        : {
            body: exampleAccountCsv(),
            filename: "contoh_impor_akun.csv",
            headers: [...ACCOUNT_IMPORT_HEADERS],
          };

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "x-import-headers": headers.join(","),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
