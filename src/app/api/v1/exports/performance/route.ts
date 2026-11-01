import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit";
import { getRequestId, jsonError } from "@/lib/api";
import { csvFileName, toCsv } from "@/lib/csv";
import { formatDateTimeId } from "@/lib/dates";
import {
  listPerformanceRows,
  parsePerformanceFilters,
  type PerformanceRow,
} from "@/lib/performance";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import { assertCapability } from "@/lib/rbac";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<PerformanceRow["status"], string> = {
  MET: "Tercapai",
  BELOW: "Di bawah target",
  NO_TARGET: "Target belum ditetapkan",
};

const HEADERS = [
  "Kedeputian",
  "Cabang",
  "Nama Instansi",
  "Kode Instansi",
  "Jenis Instansi",
  "Target",
  "Realisasi Approved",
  "Selisih",
  "Capaian Persen",
  "Status",
  "Periode",
  "Diperbarui",
];

function streamCsv(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunkSize = 64 * 1024;
  return new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < text.length; offset += chunkSize) {
        controller.enqueue(
          encoder.encode(text.slice(offset, offset + chunkSize)),
        );
      }
      controller.close();
    },
  });
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);

  try {
    const user = await getApiUser();
    assertCapability(user, "performance:export");

    const limit = await consumeRateLimit({
      key: `export:performance:${user.id}:${getClientIp(request)}`,
      limit: 10,
      windowSeconds: 60,
    });
    const rateHeaders = await getRateLimitHeaders(limit);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Terlalu banyak ekspor. Coba lagi sebentar.",
          },
          meta: { requestId },
        },
        { status: 429, headers: rateHeaders },
      );
    }

    const filters = parsePerformanceFilters(url.searchParams);
    const { rows, summary } = await listPerformanceRows(user, filters);

    const csv = toCsv(
      HEADERS,
      rows.map((row) => [
        row.regionName ?? "",
        row.branchName ?? "",
        row.name,
        row.faskesCode ?? "",
        row.sourceLabel,
        row.target === null ? "N/A" : row.target,
        row.approved,
        row.difference === null ? "N/A" : row.difference,
        row.achievement === null ? "N/A" : row.achievement.toFixed(1),
        STATUS_LABEL[row.status],
        filters.period.label,
        formatDateTimeId(row.updatedAt),
      ]),
    );

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "EXPORT_PERFORMANCE_CSV",
      recordType: "REPORT",
      recordId: filters.period.key,
      source: "API",
      requestId,
      after: {
        period: filters.period.key,
        branchId: filters.branchId,
        source: filters.source,
        status: filters.status,
        q: filters.q,
        rows: rows.length,
        approved: summary.approved,
        target: summary.target,
      },
    });

    return new NextResponse(streamCsv(csv), {
      status: 200,
      headers: {
        ...rateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFileName(
          "kinerja",
          new Date(),
          filters.period.key,
        )}"`,
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
