import "server-only";

import { and, count, eq, sql } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { contentScopePredicate } from "@/lib/authz/predicates";
import {
  CONTENT_TYPE_LABELS,
  MAIN_THEME_LABELS,
  SUB_THEME_LABELS,
} from "@/lib/edufast/policy";
import { cachedRead, readCacheKey } from "@/lib/read-cache";
import type { SessionUser } from "@/lib/session";

export type DistributionRow = { key: string; label: string; total: number };

async function distribution(
  user: SessionUser,
  column:
    | typeof schema.contentSubmissions.contentType
    | typeof schema.contentSubmissions.mainTheme
    | typeof schema.contentSubmissions.subTheme
    | typeof schema.contentSubmissions.platform
    | typeof schema.contentSubmissions.status,
  labels: Record<string, string>,
  name: string,
): Promise<DistributionRow[]> {
  return cachedRead(readCacheKey(user, ["distribution", name]), async () => {
    const scope = contentScopePredicate(
      user,
      schema.contentSubmissions.stakeholderId,
    );
    const conditions = [eq(schema.contentSubmissions.archived, false)];
    if (scope) conditions.push(scope);

    const rows = await getDb()
      .select({ key: column, total: count() })
      .from(schema.contentSubmissions)
      .where(and(...conditions))
      .groupBy(column)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      key: row.key ?? "UNKNOWN",
      label: labels[row.key ?? "UNKNOWN"] ?? row.key ?? "Tidak diketahui",
      total: Number(row.total),
    }));
  });
}

export function getContentTypeDistribution(user: SessionUser) {
  return distribution(
    user,
    schema.contentSubmissions.contentType,
    CONTENT_TYPE_LABELS,
    "content-type",
  );
}

export function getMainThemeDistribution(user: SessionUser) {
  return distribution(
    user,
    schema.contentSubmissions.mainTheme,
    MAIN_THEME_LABELS,
    "main-theme",
  );
}

export function getSubThemeDistribution(user: SessionUser) {
  return distribution(
    user,
    schema.contentSubmissions.subTheme,
    SUB_THEME_LABELS,
    "sub-theme",
  );
}

export function getPlatformDistribution(user: SessionUser) {
  return distribution(
    user,
    schema.contentSubmissions.platform,
    {
      INSTAGRAM: "Instagram",
      FACEBOOK: "Facebook",
      X: "X",
      TIKTOK: "TikTok",
      YOUTUBE: "YouTube",
      WEBSITE: "Website",
      LAINNYA: "Lainnya",
    },
    "platform",
  );
}

export function getStatusDistribution(user: SessionUser) {
  return distribution(
    user,
    schema.contentSubmissions.status,
    {
      DRAFT: "Draf",
      SUBMITTED: "Terkirim",
      RESUBMITTED: "Dikirim ulang",
      IN_REVIEW: "Ditinjau",
      APPROVED: "Disetujui",
      REVISION_REQUIRED: "Perlu revisi",
      REJECTED: "Ditolak",
      REVOKED: "Dicabut",
      ARCHIVED: "Diarsipkan",
    },
    "status",
  );
}

export async function getEdufastCompliance(user: SessionUser): Promise<{
  edufastApproved: number;
  nonEdufastApproved: number;
  subThemes: DistributionRow[];
}> {
  return cachedRead(readCacheKey(user, ["edufast-compliance"]), () =>
    loadEdufastCompliance(user),
  );
}

async function loadEdufastCompliance(user: SessionUser): Promise<{
  edufastApproved: number;
  nonEdufastApproved: number;
  subThemes: DistributionRow[];
}> {
  const approvedScope = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  const conditions = [
    eq(schema.contentSubmissions.archived, false),
    eq(schema.contentSubmissions.status, "APPROVED"),
  ];
  if (approvedScope) conditions.push(approvedScope);

  const rows = await getDb()
    .select({
      mainTheme: schema.contentSubmissions.mainTheme,
      subTheme: schema.contentSubmissions.subTheme,
      total: count(),
    })
    .from(schema.contentSubmissions)
    .where(and(...conditions))
    .groupBy(
      schema.contentSubmissions.mainTheme,
      schema.contentSubmissions.subTheme,
    );

  let edufastApproved = 0;
  let nonEdufastApproved = 0;
  const subTotals = new Map<string, number>();
  for (const row of rows) {
    const total = Number(row.total);
    if (row.mainTheme === "EDUFAST") edufastApproved += total;
    else nonEdufastApproved += total;
    if (row.subTheme) {
      subTotals.set(row.subTheme, (subTotals.get(row.subTheme) ?? 0) + total);
    }
  }

  return {
    edufastApproved,
    nonEdufastApproved,
    subThemes: [...subTotals.entries()]
      .map(([key, total]) => ({
        key,
        label: SUB_THEME_LABELS[key as keyof typeof SUB_THEME_LABELS] ?? key,
        total,
      }))
      .sort((a, b) => b.total - a.total),
  };
}
