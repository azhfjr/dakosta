import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  approvedContentCondition,
  jakartaDayEndExclusive,
  jakartaDayStart,
} from "@/lib/analytics/approved";
import { contentScopePredicate } from "@/lib/authz/predicates";
import {
  CONTENT_STATUSES,
  LEGACY_STATUS_MAP,
  normalizeStatus,
  type ContentStatus,
} from "@/lib/content-status";
import { monthRange } from "@/lib/kpi/formulas";
import {
  ORG_SOURCE_LABELS,
  orgSourceCondition,
  parseOrgSources,
  sourceOfOrganization,
  type OrgSource,
} from "@/lib/analytics/source";
import type { SessionUser } from "@/lib/session";
import type { ContentType, MainTheme, SubTheme } from "@/lib/taxonomy";

export const ANALYTICS_TABLE_PAGE_SIZE = 25;

export type AnalyticsSort =
  | "recent"
  | "oldest"
  | "code"
  | "title"
  | "organization"
  | "type"
  | "platform"
  | "status"
  | "approved_recent"
  | "approved_oldest";

export type SortDirection = "asc" | "desc";

/**
 * Filtering and sorting must see legacy rows (deploy→migration window) as
 * their canonical status, otherwise the four status tabs disagree with the
 * table.
 */
function statusFilterValues(status: ContentStatus): string[] {
  return [
    status,
    ...Object.entries(LEGACY_STATUS_MAP)
      .filter(([, canonical]) => canonical === status)
      .map(([legacy]) => legacy),
  ];
}

const NORMALIZED_STATUS = sql<string>`case ${schema.contentSubmissions.status} ${sql.raw(
  Object.entries(LEGACY_STATUS_MAP)
    .map(([legacy, canonical]) => `when '${legacy}' then '${canonical}'`)
    .join(" "),
)} else ${schema.contentSubmissions.status} end`;

export type AnalyticsContentFilters = {
  period: string;
  /** `created` filters `date_created`; `approved` filters `approved_at`. */
  periodBasis?: "created" | "approved";
  status: ContentStatus | "ALL";
  /**
   * `approved` forces the canonical approved predicate (status, timestamp,
   * not archived). Dashboard and Detail Konten approved views use it so a URL
   * cannot widen the table beyond validated content.
   */
  scope?: "all" | "approved";
  sources: OrgSource[];
  stakeholderId?: string | null;
  branchId?: string | null;
  mainTheme?: MainTheme | null;
  subTheme?: SubTheme | null;
  contentType?: ContentType | null;
  platform?: string | null;
  /** Inclusive calendar dates in Asia/Jakarta, applied to `approved_at`. */
  dateFrom?: string | null;
  dateTo?: string | null;
  decidedBy: "ANY" | "BRANCH" | "MASTER";
  sort: AnalyticsSort;
  direction?: SortDirection;
  search: string;
  page: number;
  /** Report exports raise this; the table keeps the default page size. */
  pageSize?: number;
};

/** Ceiling shared with report exports so `CONTENT_REPORT_ROW_CAP` stays truthful. */
export const ANALYTICS_TABLE_MAX_PAGE_SIZE = 2000;

const SORTS: readonly AnalyticsSort[] = [
  "recent",
  "oldest",
  "code",
  "title",
  "organization",
  "type",
  "platform",
  "status",
  "approved_recent",
  "approved_oldest",
];

function firstValue(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseAnalyticsContentFilters(
  params: Record<string, string | string[] | undefined>,
): AnalyticsContentFilters {
  const rawPeriod = firstValue(params, "period");
  const period =
    rawPeriod &&
    rawPeriod.toUpperCase() !== "ALL" &&
    /^\d{4}-\d{2}$/.test(rawPeriod)
      ? rawPeriod
      : "ALL";

  const rawStatus = firstValue(params, "status")?.toUpperCase();
  const status =
    rawStatus && (CONTENT_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as ContentStatus)
      : "ALL";

  const rawDecidedBy = firstValue(params, "decidedBy")?.toUpperCase();
  const decidedBy =
    rawDecidedBy === "BRANCH" || rawDecidedBy === "MASTER"
      ? rawDecidedBy
      : "ANY";

  const rawSort = firstValue(params, "sort")?.toLowerCase();
  const sort = SORTS.includes(rawSort as AnalyticsSort)
    ? (rawSort as AnalyticsSort)
    : "recent";
  const rawDirection = firstValue(params, "direction")?.toLowerCase();
  const direction: SortDirection =
    rawDirection === "asc" || rawDirection === "desc" ? rawDirection : "desc";

  const rawPage = Number(firstValue(params, "page"));
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  return {
    period,
    status,
    sources: parseOrgSources(params),
    decidedBy,
    sort,
    direction,
    search: (firstValue(params, "q") ?? "").trim().slice(0, 80),
    page,
  };
}

export type AnalyticsContentRow = {
  id: string;
  referenceCode: string;
  title: string | null;
  organization: string;
  branchName: string | null;
  organizationType: string;
  faskesClass: string | null;
  source: OrgSource;
  sourceLabel: string;
  contentType: string | null;
  mainTheme: string | null;
  subTheme: string | null;
  platform: string | null;
  status: ContentStatus;
  dateCreated: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
  decisionAt: Date | null;
  decidedBy: string | null;
  decisionSource: string | null;
  version: number;
  resubmissionCount: number;
  publishedUrl: string | null;
};

export type AnalyticsContentPage = {
  rows: AnalyticsContentRow[];
  total: number;
  page: number;
  pageCount: number;
  approvedTotal: number;
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function listAnalyticsContents(
  user: SessionUser,
  filters: AnalyticsContentFilters,
): Promise<AnalyticsContentPage> {
  const db = getDb();
  const conditions: SQL[] = [eq(schema.contentSubmissions.archived, false)];
  const scope = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  if (scope) conditions.push(scope);
  if (filters.scope === "approved") {
    conditions.push(approvedContentCondition());
  }
  if (filters.status !== "ALL") {
    conditions.push(
      inArray(
        schema.contentSubmissions.status,
        statusFilterValues(filters.status),
      ),
    );
  }
  const sourceCondition = orgSourceCondition(
    schema.contentSubmissions.stakeholderId,
    filters.sources,
  );
  if (sourceCondition) conditions.push(sourceCondition);
  if (filters.stakeholderId) {
    conditions.push(
      eq(schema.contentSubmissions.stakeholderId, filters.stakeholderId),
    );
  }
  if (filters.branchId) {
    conditions.push(eq(schema.stakeholders.branchOfficeId, filters.branchId));
  }
  if (filters.mainTheme) {
    conditions.push(eq(schema.contentSubmissions.mainTheme, filters.mainTheme));
  }
  if (filters.subTheme) {
    conditions.push(eq(schema.contentSubmissions.subTheme, filters.subTheme));
  }
  if (filters.contentType) {
    conditions.push(
      eq(schema.contentSubmissions.contentType, filters.contentType),
    );
  }
  if (filters.platform) {
    conditions.push(eq(schema.contentSubmissions.platform, filters.platform));
  }
  if (filters.dateFrom) {
    conditions.push(
      filters.scope === "approved"
        ? gte(
            schema.contentSubmissions.approvedAt,
            jakartaDayStart(filters.dateFrom),
          )
        : gte(schema.contentSubmissions.dateCreated, filters.dateFrom),
    );
  }
  if (filters.dateTo) {
    conditions.push(
      filters.scope === "approved"
        ? lt(
            schema.contentSubmissions.approvedAt,
            jakartaDayEndExclusive(filters.dateTo),
          )
        : lte(schema.contentSubmissions.dateCreated, filters.dateTo),
    );
  }
  if (filters.period !== "ALL") {
    const range = monthRange(filters.period);
    if (filters.periodBasis === "approved") {
      conditions.push(
        gte(schema.contentSubmissions.approvedAt, range.startInstant),
        lt(schema.contentSubmissions.approvedAt, range.endInstant),
      );
    } else {
      conditions.push(
        gte(schema.contentSubmissions.dateCreated, range.startLocal),
        lte(schema.contentSubmissions.dateCreated, range.endLocal),
      );
    }
  }
  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`;
    const search = or(
      ilike(schema.contentSubmissions.title, pattern),
      ilike(schema.contentSubmissions.referenceCode, pattern),
      ilike(schema.stakeholders.name, pattern),
    );
    if (search) conditions.push(search);
  }
  if (filters.decidedBy !== "ANY") {
    const role =
      filters.decidedBy === "BRANCH" ? "BRANCH_ADMIN" : "MASTER_ADMIN";
    conditions.push(
      sql`exists (
        select 1 from content_reviews cr
        where cr.submission_id = ${schema.contentSubmissions.id}
          and cr.reviewer_role = ${role}
      )`,
    );
  }
  const where = and(...conditions);

  const latestReview = db
    .selectDistinctOn([schema.contentReviews.submissionId], {
      submissionId: schema.contentReviews.submissionId,
      reviewerRole: schema.contentReviews.reviewerRole,
      decisionSource: schema.contentReviews.decisionSource,
      createdAt: schema.contentReviews.createdAt,
    })
    .from(schema.contentReviews)
    .orderBy(
      asc(schema.contentReviews.submissionId),
      desc(schema.contentReviews.createdAt),
    )
    .as("latest_review");

  const direction = filters.direction ?? "desc";
  const ascending = direction === "asc";
  const orderBy = (() => {
    switch (filters.sort) {
      case "code":
        return [
          ascending
            ? asc(schema.contentSubmissions.referenceCode)
            : desc(schema.contentSubmissions.referenceCode),
          ascending
            ? asc(schema.contentSubmissions.id)
            : desc(schema.contentSubmissions.id),
        ];
      case "title":
        return [
          ascending
            ? asc(schema.contentSubmissions.title)
            : desc(schema.contentSubmissions.title),
          ascending
            ? asc(schema.contentSubmissions.id)
            : desc(schema.contentSubmissions.id),
        ];
      case "organization":
        return [
          ascending
            ? asc(schema.stakeholders.name)
            : desc(schema.stakeholders.name),
          ascending
            ? asc(schema.contentSubmissions.title)
            : desc(schema.contentSubmissions.title),
          asc(schema.contentSubmissions.id),
        ];
      case "type":
        return [
          sql`${schema.contentSubmissions.contentType} ${sql.raw(ascending ? "asc" : "desc")} nulls last`,
          desc(schema.contentSubmissions.dateCreated),
          asc(schema.contentSubmissions.id),
        ];
      case "platform":
        return [
          sql`${schema.contentSubmissions.platform} ${sql.raw(ascending ? "asc" : "desc")} nulls last`,
          desc(schema.contentSubmissions.dateCreated),
          asc(schema.contentSubmissions.id),
        ];
      case "status":
        return [
          ascending ? asc(NORMALIZED_STATUS) : desc(NORMALIZED_STATUS),
          desc(schema.contentSubmissions.dateCreated),
          asc(schema.contentSubmissions.id),
        ];
      case "approved_recent":
      case "approved_oldest":
        return [
          sql`${schema.contentSubmissions.approvedAt} ${sql.raw(ascending ? "asc" : "desc")} nulls last`,
          ascending
            ? asc(schema.contentSubmissions.id)
            : desc(schema.contentSubmissions.id),
        ];
      default:
        return [
          ascending
            ? asc(schema.contentSubmissions.dateCreated)
            : desc(schema.contentSubmissions.dateCreated),
          ascending
            ? asc(schema.contentSubmissions.id)
            : desc(schema.contentSubmissions.id),
        ];
    }
  })();

  const pageSize = Math.min(
    Math.max(Math.floor(filters.pageSize ?? ANALYTICS_TABLE_PAGE_SIZE), 1),
    ANALYTICS_TABLE_MAX_PAGE_SIZE,
  );

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: schema.contentSubmissions.id,
        referenceCode: schema.contentSubmissions.referenceCode,
        title: schema.contentSubmissions.title,
        organization: schema.stakeholders.name,
        branchName: schema.branchOffices.name,
        organizationType: schema.stakeholders.organizationType,
        faskesClass: schema.stakeholders.faskesClass,
        contentType: schema.contentSubmissions.contentType,
        mainTheme: schema.contentSubmissions.mainTheme,
        subTheme: schema.contentSubmissions.subTheme,
        platform: schema.contentSubmissions.platform,
        status: schema.contentSubmissions.status,
        dateCreated: schema.contentSubmissions.dateCreated,
        submittedAt: schema.contentSubmissions.submittedAt,
        approvedAt: schema.contentSubmissions.approvedAt,
        version: schema.contentSubmissions.version,
        resubmissionCount: schema.contentSubmissions.resubmissionCount,
        publishedUrl: schema.contentSubmissions.publishedUrl,
        decisionAt: latestReview.createdAt,
        decidedBy: latestReview.reviewerRole,
        decisionSource: latestReview.decisionSource,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .leftJoin(
        schema.branchOffices,
        eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
      )
      .leftJoin(
        latestReview,
        eq(latestReview.submissionId, schema.contentSubmissions.id),
      )
      .where(where)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((filters.page - 1) * pageSize),
    db
      .select({
        total: count(),
        approved: sql<number>`count(*) filter (where ${schema.contentSubmissions.status} = 'APPROVED')`,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(where),
  ]);

  const total = Number(totals[0]?.total ?? 0);
  const approvedTotal = Number(totals[0]?.approved ?? 0);

  return {
    rows: rows.map((row) => {
      const source = sourceOfOrganization(row);
      return {
        ...row,
        status: normalizeStatus(row.status),
        source,
        sourceLabel: ORG_SOURCE_LABELS[source],
        decisionAt: row.decisionAt ? new Date(row.decisionAt) : null,
      };
    }),
    total,
    approvedTotal,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export const ANALYTICS_SORT_LABELS: Record<AnalyticsSort, string> = {
  recent: "Terbaru dibuat",
  oldest: "Terlama dibuat",
  code: "Kode",
  title: "Judul",
  organization: "Organisasi",
  type: "Jenis konten",
  platform: "Platform",
  status: "Status",
  approved_recent: "Terbaru disetujui",
  approved_oldest: "Terlama disetujui",
};

export const ANALYTICS_PERIOD_LABEL = "Semua periode";
