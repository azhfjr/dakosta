import { NextResponse } from "next/server";

import { getRequestId, jsonError, jsonOk } from "@/lib/api";
import { requireMasterApi } from "@/lib/authz/guards";
import { listImports } from "@/lib/imports/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await requireMasterApi();
    const rows = await listImports(25);
    return jsonOk(rows, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 204 });
}
