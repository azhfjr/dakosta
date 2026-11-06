import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb, schema } from "@/db";
import { contentScopePredicate } from "@/lib/authz/predicates";
import { CONTENT_STATUSES, type ContentStatus } from "@/lib/content-status";
import { monthRange } from "@/lib/kpi/formulas";
import {
  ORG_SOURCE_LABELS,
  orgSourceCondition,
  parseOrgSources,
  sourceOfOrganization,
  type OrgSource,
} from "@/lib/analytics/source";
import type { SessionUser } from "@/lib/session";
import type { ContentType, SubTheme } from "@/lib/taxonomy";

export const ANALYTICS_TABLE_PAGE_SIZE = 25;

export type AnalyticsSort =
  | "recent"
  | "oldest"
  | "title"
  | "decision"
  | "status"
  | "approved_recent"
  | "approved_oldest"
  | "organization";

export type AnalyticsContentFilters = {
  period: string;
  /** `created` filters `date_created`; `approved` filters `approved_at`. */
  periodBasis?: "created" | "approved";
  status: ContentStatus | "ALL";
  sources: OrgSource[];
  stakeholderId?: string | null;
  subTheme?: SubTheme | null;
  contentType?: ContentType | null;
  decidedBy: "ANY" | "BRANCH" | "MASTER";
  sort: AnalyticsSort;
  search: string;
  page: number;
};

const SORTS: readonly AnalyticsSort[] = [
  "recent",
  "oldest",
  "title",
  "decision",
  "status",
  "approved_recent",
  "approved_oldest",
  "organization",
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

  const rawPage = Number(firstValue(params, "page"));
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  return {
    period,
    status,
    sources: parseOrgSources(params),
    decidedBy,
    sort,
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
  if (filters.status !== "ALL") {
    conditions.push(eq(schema.contentSubmissions.status, filters.status));
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
  if (filters.subTheme) {
    conditions.push(eq(schema.contentSubmissions.subTheme, filters.subTheme));
  }
  if (filters.contentType) {
    conditions.push(
      eq(schema.contentSubmissions.contentType, filters.contentType),
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

  const orderBy = (() => {
    switch (filters.sort) {
      case "oldest":
        return [
          asc(schema.contentSubmissions.dateCreated),
          asc(schema.contentSubmissions.id),
        ];
      case "title":
        return [
          asc(schema.contentSubmissions.title),
          asc(schema.contentSubmissions.id),
        ];
      case "decision":
        return [
          sql`${latestReview.createdAt} desc nulls last`,
          asc(schema.contentSubmissions.id),
        ];
      case "status":
        return [
          asc(schema.contentSubmissions.status),
          desc(schema.contentSubmissions.dateCreated),
        ];
      case "approved_recent":
        return [
          sql`${schema.contentSubmissions.approvedAt} desc nulls last`,
          desc(schema.contentSubmissions.id),
        ];
      case "approved_oldest":
        return [
          sql`${schema.contentSubmissions.approvedAt} asc nulls last`,
          asc(schema.contentSubmissions.id),
        ];
      case "organization":
        return [
          asc(schema.stakeholders.name),
          asc(schema.contentSubmissions.title),
          asc(schema.contentSubmissions.id),
        ];
      default:
        return [
          desc(schema.contentSubmissions.dateCreated),
          desc(schema.contentSubmissions.id),
        ];
    }
  })();

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
      .limit(ANALYTICS_TABLE_PAGE_SIZE)
      .offset((filters.page - 1) * ANALYTICS_TABLE_PAGE_SIZE),
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
        status: row.status as ContentStatus,
        source,
        sourceLabel: ORG_SOURCE_LABELS[source],
        decisionAt: row.decisionAt ? new Date(row.decisionAt) : null,
      };
    }),
    total,
    approvedTotal,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / ANALYTICS_TABLE_PAGE_SIZE)),
  };
}

export const ANALYTICS_SORT_LABELS: Record<AnalyticsSort, string> = {
  recent: "Terbaru dibuat",
  oldest: "Terlama dibuat",
  title: "Judul A–Z",
  decision: "Keputusan terbaru",
  status: "Status",
  approved_recent: "Terbaru disetujui",
  approved_oldest: "Terlama disetujui",
  organization: "Organisasi A–Z",
};

export const ANALYTICS_PERIOD_LABEL = "Semua periode";
