import { and, desc, eq, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb, schema } from "@/db";
import { getRequestId, jsonError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { CONTENT_STATUSES, PLATFORM_LABEL, STATUS_LABEL } from "@/lib/content-status";
import { csvFileName, toCsv } from "@/lib/csv";
import { formatDateId, formatDateTimeId } from "@/lib/dates";
import { errors } from "@/lib/errors";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";
import {
  contentScopePredicate,
  isOrganizationInScope,
} from "@/lib/authz/predicates";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_LIMIT = 2000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function param(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key);
  return value && UUID_PATTERN.test(value) ? value : null;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);

  try {
    const user = await getApiUser();
    const limit = await consumeRateLimit({
      key: `export:${user.id}:${getClientIp(request)}`,
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

    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus && (CONTENT_STATUSES as readonly string[]).includes(rawStatus)
        ? rawStatus
        : null;
    const stakeholderId = param(url.searchParams, "stakeholderId");
    const themeId = param(url.searchParams, "themeId");

    if (stakeholderId && user.scope.kind !== "GLOBAL") {
      const [organization] = await getDb()
        .select({
          id: schema.stakeholders.id,
          branchOfficeId: schema.stakeholders.branchOfficeId,
        })
        .from(schema.stakeholders)
        .where(eq(schema.stakeholders.id, stakeholderId))
        .limit(1);
      if (!organization || !isOrganizationInScope(user.scope, organization)) {
        await recordAudit({
          actorId: user.id,
          actorRole: user.role,
          action: "ACCESS_DENIED",
          recordType: "ORGANIZATION",
          recordId: stakeholderId,
          after: { reason: "organization_scope_mismatch", route: "export", requestId },
        });
        throw errors.forbidden("Anda tidak memiliki akses ke organisasi tersebut.");
      }
    }

    const conditions: SQL[] = [];
    const scopePredicate = contentScopePredicate(
      user,
      schema.contentSubmissions.stakeholderId,
    );
    if (scopePredicate) conditions.push(scopePredicate);
    if (status) {
      conditions.push(eq(schema.contentSubmissions.status, status));
    }
    if (stakeholderId) {
      conditions.push(eq(schema.contentSubmissions.stakeholderId, stakeholderId));
    }
    if (themeId) {
      conditions.push(eq(schema.contentSubmissions.themeId, themeId));
    }

    const rows = await getDb()
      .select({
        referenceCode: schema.contentSubmissions.referenceCode,
        title: schema.contentSubmissions.title,
        stakeholderName: schema.stakeholders.name,
        themeName: schema.themes.name,
        platform: schema.contentSubmissions.platform,
        status: schema.contentSubmissions.status,
        dateCreated: schema.contentSubmissions.dateCreated,
        submittedAt: schema.contentSubmissions.submittedAt,
        approvedAt: schema.contentSubmissions.approvedAt,
        updatedAt: schema.contentSubmissions.updatedAt,
        locationLabel: schema.locations.label,
        precision: schema.locations.precision,
        verifiedStatus: schema.locations.verifiedStatus,
        publishedUrl: schema.contentSubmissions.publishedUrl,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .innerJoin(
        schema.themes,
        eq(schema.themes.id, schema.contentSubmissions.themeId),
      )
      .innerJoin(
        schema.locations,
        eq(schema.locations.id, schema.contentSubmissions.locationId),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.contentSubmissions.updatedAt))
      .limit(EXPORT_LIMIT);

    const csv = toCsv(
      [
        "Referensi",
        "Judul",
        "Stakeholder",
        "Tema",
        "Platform",
        "Status",
        "Tanggal konten",
        "Dikirim",
        "Disetujui",
        "Diperbarui",
        "Label lokasi",
        "Presisi",
        "Status verifikasi lokasi",
        "URL terbit",
        "Sumber data",
      ],
      rows.map((row) => [
        row.referenceCode,
        row.title ?? "",
        row.stakeholderName,
        row.themeName,
        PLATFORM_LABEL[row.platform] ?? row.platform,
        STATUS_LABEL[row.status as keyof typeof STATUS_LABEL] ?? row.status,
        formatDateId(row.dateCreated),
        formatDateTimeId(row.submittedAt),
        formatDateTimeId(row.approvedAt),
        formatDateTimeId(row.updatedAt),
        row.locationLabel,
        row.precision === "exact" ? "Presisi" : "Perkiraan",
        row.verifiedStatus === "VERIFIED" ? "Terverifikasi" : "Belum diverifikasi",
        row.publishedUrl,
        "DEMO",
      ]),
    );

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "EXPORT_GENERATED",
      recordType: "EXPORT",
      recordId: "submissions",
      after: { format: "csv", rows: rows.length, status, stakeholderId, themeId, requestId },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFileName("dakosta-konten")}"`,
        "Cache-Control": "no-store",
        ...rateHeaders,
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
