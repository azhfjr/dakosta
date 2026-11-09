import "server-only";

import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { getDb, schema } from "@/db";
import { contentScopePredicate } from "@/lib/authz/predicates";
import {
  PENDING_STATUSES,
  PLATFORM_LABEL,
  type ContentStatus,
} from "@/lib/content-status";
import {
  CONTENT_TYPE_LABELS,
  type ContentType,
  type MainTheme,
} from "@/lib/taxonomy";
import { monthRange, type KpiFilters } from "@/lib/kpi/formulas";
import { parsePeriod, type Period } from "@/lib/periods";
import { monthWindow, trailingMonthKeys } from "@/lib/analytics/period-window";
import { cachedRead, readCacheKey } from "@/lib/read-cache";
import type { SessionUser } from "@/lib/session";
import {
  ORG_SOURCE_LABELS,
  orgSourceCondition,
  sourceOfOrganization,
  type OrgSource,
} from "@/lib/analytics/source";

export type AnalyticsChartFilters = KpiFilters & {
  sources: OrgSource[];
  orgType?: "FASKES" | "PEMDA" | "OTHER" | null;
  mainTheme?: MainTheme | null;
};

const DAY_SECONDS = 86_400;
const DAY_MS = 86_400_000;

function periodOf(filters: AnalyticsChartFilters): Period {
  return parsePeriod(filters.periodKey ?? filters.month);
}

function where(conditions: Array<SQL | undefined>): SQL | undefined {
  const present = conditions.filter((item): item is SQL => Boolean(item));
  return present.length === 0 ? undefined : and(...present);
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function scopeConditions(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): SQL[] {
  const conditions: SQL[] = [eq(schema.contentSubmissions.archived, false)];
  const scope = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  if (scope) conditions.push(scope);
  if (filters.stakeholderId) {
    conditions.push(
      eq(schema.contentSubmissions.stakeholderId, filters.stakeholderId),
    );
  }
  if (filters.subTheme) {
    conditions.push(eq(schema.contentSubmissions.subTheme, filters.subTheme));
  }
  const source = orgSourceCondition(
    schema.contentSubmissions.stakeholderId,
    filters.sources,
  );
  if (source) conditions.push(source);
  if (filters.orgType) {
    conditions.push(
      inArray(
        schema.contentSubmissions.stakeholderId,
        getDb()
          .select({ id: schema.stakeholders.id })
          .from(schema.stakeholders)
          .where(eq(schema.stakeholders.organizationType, filters.orgType)),
      ),
    );
  }
  if (filters.mainTheme) {
    conditions.push(eq(schema.contentSubmissions.mainTheme, filters.mainTheme));
  }
  return conditions;
}

function createdIn(period: Period): SQL[] {
  return [
    gte(schema.contentSubmissions.dateCreated, period.startDate),
    lte(schema.contentSubmissions.dateCreated, period.endDate),
  ];
}

function approvedIn(period: Period): SQL[] {
  return [
    eq(schema.contentSubmissions.status, "APPROVED"),
    gte(schema.contentSubmissions.approvedAt, period.start),
    lt(schema.contentSubmissions.approvedAt, period.endExclusive),
  ];
}

export type SubmissionVolumePoint = {
  month: string;
  label: string;
  total: number;
  draft: number;
  pending: number;
  approved: number;
  revision: number;
};

/**
 * All-content submission volume by creation date. Every status is counted, so
 * the stack never mixes approval-dated figures.
 */
export async function getSubmissionVolumeSeries(
  user: SessionUser,
  filters: AnalyticsChartFilters,
  minimumMonths = 6,
): Promise<SubmissionVolumePoint[]> {
  const keys = trailingMonthKeys(periodOf(filters), minimumMonths);
  const window = monthWindow(keys);
  const monthExpr = sql<string>`to_char(${schema.contentSubmissions.dateCreated}, 'YYYY-MM')`;
  const rows = await getDb()
    .select({
      month: monthExpr,
      status: schema.contentSubmissions.status,
      total: count(),
    })
    .from(schema.contentSubmissions)
    .where(
      where([
        ...scopeConditions(user, filters),
        gte(schema.contentSubmissions.dateCreated, window.start),
        lte(schema.contentSubmissions.dateCreated, window.end),
      ]),
    )
    .groupBy(monthExpr, schema.contentSubmissions.status);

  const points = new Map<string, SubmissionVolumePoint>();
  for (const key of keys) {
    points.set(key, {
      month: key,
      label: monthRange(key).shortLabel,
      total: 0,
      draft: 0,
      pending: 0,
      approved: 0,
      revision: 0,
    });
  }
  for (const row of rows) {
    const point = points.get(row.month);
    if (!point) continue;
    const total = toNumber(row.total);
    point.total += total;
    if (row.status === "DRAFT") point.draft += total;
    else if ((PENDING_STATUSES as readonly string[]).includes(row.status)) {
      point.pending += total;
    } else if (row.status === "APPROVED") point.approved += total;
    else if (row.status === "REVISION_REQUIRED") point.revision += total;
  }
  return keys.map((key) => points.get(key)!);
}

export type StatusCount = { status: ContentStatus; total: number };

export async function getStatusComposition(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): Promise<StatusCount[]> {
  const period = periodOf(filters);
  const rows = await getDb()
    .select({
      status: schema.contentSubmissions.status,
      total: count(),
    })
    .from(schema.contentSubmissions)
    .where(where([...scopeConditions(user, filters), ...createdIn(period)]))
    .groupBy(schema.contentSubmissions.status)
    .orderBy(desc(count()));

  return rows.map((row) => ({
    status: row.status as ContentStatus,
    total: toNumber(row.total),
  }));
}

export type NamedSlice = { key: string; label: string; total: number };

async function statusMix(
  user: SessionUser,
  filters: AnalyticsChartFilters,
  column: AnyPgColumn,
  scope: "all" | "approved",
  labelFor: (key: string | null) => string,
): Promise<NamedSlice[]> {
  const period = periodOf(filters);
  const conditions = scopeConditions(user, filters);
  if (scope === "approved") conditions.push(...approvedIn(period));
  else conditions.push(...createdIn(period));

  const rows = await getDb()
    .select({ key: column, total: count() })
    .from(schema.contentSubmissions)
    .where(where(conditions))
    .groupBy(column)
    .orderBy(desc(count()));

  return rows
    .map((row) => ({
      key: row.key ?? "UNSET",
      label: labelFor(row.key),
      total: toNumber(row.total),
    }))
    .filter((row) => row.total > 0);
}

export function getContentTypeMix(
  user: SessionUser,
  filters: AnalyticsChartFilters,
  scope: "all" | "approved" = "all",
): Promise<NamedSlice[]> {
  return statusMix(
    user,
    filters,
    schema.contentSubmissions.contentType,
    scope,
    (key) =>
      key ? (CONTENT_TYPE_LABELS[key as ContentType] ?? key) : "Tidak diisi",
  );
}

export function getPlatformMix(
  user: SessionUser,
  filters: AnalyticsChartFilters,
  scope: "all" | "approved" = "all",
): Promise<NamedSlice[]> {
  return statusMix(
    user,
    filters,
    schema.contentSubmissions.platform,
    scope,
    (key) => (key ? (PLATFORM_LABEL[key] ?? key) : "Tidak diisi"),
  );
}

export type AgingBucket = { bucket: string; label: string; total: number };

/** Current validation queue age; follows user scope and active filters. */
export async function getReviewAging(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): Promise<AgingBucket[]> {
  const rows = await getDb()
    .select({ submittedAt: schema.contentSubmissions.submittedAt })
    .from(schema.contentSubmissions)
    .where(
      where([
        ...scopeConditions(user, filters),
        inArray(schema.contentSubmissions.status, [...PENDING_STATUSES]),
        isNotNull(schema.contentSubmissions.submittedAt),
      ]),
    );

  const buckets: AgingBucket[] = [
    { bucket: "0-2", label: "0–2 hari", total: 0 },
    { bucket: "3-7", label: "3–7 hari", total: 0 },
    { bucket: "8-14", label: "8–14 hari", total: 0 },
    { bucket: "15+", label: ">14 hari", total: 0 },
  ];
  const now = Date.now();
  for (const row of rows) {
    if (!row.submittedAt) continue;
    const days = Math.max(0, (now - row.submittedAt.getTime()) / DAY_MS);
    const index = days < 3 ? 0 : days < 8 ? 1 : days < 15 ? 2 : 3;
    buckets[index]!.total += 1;
  }
  return buckets;
}

export type FunnelStage = { stage: string; label: string; total: number };

export type DecisionFunnel = {
  cohort: number;
  stages: FunnelStage[];
  outcomes: FunnelStage[];
};

/**
 * Real cohort funnel over contents created in the selected period. Every stage
 * is a subset of the previous one; terminal outcomes are reported separately
 * because a revoked approval is not a funnel step.
 */
export async function getDecisionFunnel(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): Promise<DecisionFunnel> {
  const period = periodOf(filters);
  const reviewed = sql<number>`count(*) filter (where exists (
    select 1 from ${schema.contentReviews}
    where ${schema.contentReviews.submissionId} = ${schema.contentSubmissions.id}
  ))`;
  const approved = sql<number>`count(*) filter (where exists (
    select 1 from ${schema.contentReviews}
    where ${schema.contentReviews.submissionId} = ${schema.contentSubmissions.id}
      and ${schema.contentReviews.action} = 'APPROVE'
  ))`;
  const submitted = sql<number>`count(*) filter (where ${schema.contentSubmissions.submittedAt} is not null)`;
  const revision = sql<number>`count(*) filter (where ${schema.contentSubmissions.status} = 'REVISION_REQUIRED')`;

  const rows = await getDb()
    .select({
      cohort: count(),
      submitted,
      reviewed,
      approved,
      revision,
    })
    .from(schema.contentSubmissions)
    .where(where([...scopeConditions(user, filters), ...createdIn(period)]));

  const row = rows[0];
  const cohort = toNumber(row?.cohort);
  return {
    cohort,
    stages: [
      { stage: "created", label: "Konten dibuat", total: cohort },
      {
        stage: "submitted",
        label: "Dikirim",
        total: toNumber(row?.submitted),
      },
      {
        stage: "reviewed",
        label: "Diputuskan",
        total: toNumber(row?.reviewed),
      },
      {
        stage: "approved",
        label: "Disetujui",
        total: toNumber(row?.approved),
      },
    ],
    outcomes: [
      {
        stage: "revision",
        label: "Perlu Revisi",
        total: toNumber(row?.revision),
      },
    ],
  };
}

export type SlaRow = {
  organizationType: string;
  contentType: string;
  samples: number;
  medianDays: number | null;
  averageDays: number | null;
};

export async function getSlaByOrgType(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): Promise<SlaRow[]> {
  const period = periodOf(filters);
  const days = sql<number>`extract(epoch from (${schema.contentSubmissions.approvedAt} - ${schema.contentSubmissions.submittedAt})) / ${DAY_SECONDS}`;
  const rows = await getDb()
    .select({
      organizationType: schema.stakeholders.organizationType,
      contentType: schema.contentSubmissions.contentType,
      samples: count(),
      medianDays: sql<number>`percentile_cont(0.5) within group (order by ${days})`,
      averageDays: sql<number>`avg(${days})`,
    })
    .from(schema.contentSubmissions)
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    )
    .where(
      where([
        ...scopeConditions(user, filters),
        ...approvedIn(period),
        isNotNull(schema.contentSubmissions.submittedAt),
      ]),
    )
    .groupBy(
      schema.stakeholders.organizationType,
      schema.contentSubmissions.contentType,
    );

  return rows.map((row) => ({
    organizationType: row.organizationType,
    contentType: row.contentType ?? "UNKNOWN",
    samples: toNumber(row.samples),
    medianDays:
      row.medianDays === null ? null : round(toNumber(row.medianDays)),
    averageDays:
      row.averageDays === null ? null : round(toNumber(row.averageDays)),
  }));
}

export type RankingRow = { id: string; name: string; total: number };

export async function getScopeRankings(
  user: SessionUser,
  filters: AnalyticsChartFilters,
  level: "branch" | "organization",
  limit = 8,
): Promise<RankingRow[]> {
  const period = periodOf(filters);
  const idColumn =
    level === "branch" ? schema.branchOffices.id : schema.stakeholders.id;
  const nameColumn =
    level === "branch" ? schema.branchOffices.name : schema.stakeholders.name;

  const query = getDb()
    .select({ id: idColumn, name: nameColumn, total: count() })
    .from(schema.contentSubmissions)
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    );
  const joined =
    level === "branch"
      ? query.innerJoin(
          schema.branchOffices,
          eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
        )
      : query;

  const rows = await joined
    .where(where([...scopeConditions(user, filters), ...approvedIn(period)]))
    .groupBy(idColumn, nameColumn)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    total: toNumber(row.total),
  }));
}

export type SourceBreakdownRow = {
  source: OrgSource;
  label: string;
  approved: number;
  pending: number;
  submitted: number;
  organizations: number;
};

/**
 * Source contribution for contents created in the period. Counting by creation
 * date keeps in-flight submissions visible instead of hiding everything that
 * has not been decided yet.
 */
export async function getSourceBreakdown(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): Promise<SourceBreakdownRow[]> {
  const period = periodOf(filters);
  const rows = await getDb()
    .select({
      organizationType: schema.stakeholders.organizationType,
      faskesClass: schema.stakeholders.faskesClass,
      stakeholderId: schema.contentSubmissions.stakeholderId,
      status: schema.contentSubmissions.status,
      total: count(),
    })
    .from(schema.contentSubmissions)
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    )
    .where(where([...scopeConditions(user, filters), ...createdIn(period)]))
    .groupBy(
      schema.stakeholders.organizationType,
      schema.stakeholders.faskesClass,
      schema.contentSubmissions.stakeholderId,
      schema.contentSubmissions.status,
    );

  const grouped = new Map<
    OrgSource,
    {
      approved: number;
      pending: number;
      submitted: number;
      organizations: Set<string>;
    }
  >();
  for (const row of rows) {
    const source = sourceOfOrganization(row);
    const current = grouped.get(source) ?? {
      approved: 0,
      pending: 0,
      submitted: 0,
      organizations: new Set<string>(),
    };
    const total = toNumber(row.total);
    if (row.status !== "DRAFT") {
      current.submitted += total;
    }
    if ((PENDING_STATUSES as readonly string[]).includes(row.status)) {
      current.pending += total;
    }
    if (row.status === "APPROVED") current.approved += total;
    current.organizations.add(row.stakeholderId);
    grouped.set(source, current);
  }

  const order: OrgSource[] = ["FASKES_FKTP", "FASKES_FKRTL", "PEMDA", "OTHER"];
  return order
    .filter((source) => grouped.has(source))
    .map((source) => {
      const value = grouped.get(source)!;
      return {
        source,
        label: ORG_SOURCE_LABELS[source],
        approved: value.approved,
        pending: value.pending,
        submitted: value.submitted,
        organizations: value.organizations.size,
      };
    });
}

export type EdufastMonth = {
  month: string;
  label: string;
  edufast: number;
  nonEdufast: number;
};

export async function getEdufastMonthly(
  user: SessionUser,
  filters: AnalyticsChartFilters,
  minimumMonths = 6,
): Promise<EdufastMonth[]> {
  const keys = trailingMonthKeys(periodOf(filters), minimumMonths);
  const first = monthRange(keys[0]!);
  const last = monthRange(keys[keys.length - 1]!);
  const monthExpr = sql<string>`to_char(${schema.contentSubmissions.approvedAt}, 'YYYY-MM')`;
  const rows = await getDb()
    .select({
      month: monthExpr,
      mainTheme: schema.contentSubmissions.mainTheme,
      total: count(),
    })
    .from(schema.contentSubmissions)
    .where(
      where([
        ...scopeConditions(user, filters),
        eq(schema.contentSubmissions.status, "APPROVED"),
        gte(schema.contentSubmissions.approvedAt, first.startInstant),
        lt(schema.contentSubmissions.approvedAt, last.endInstant),
      ]),
    )
    .groupBy(monthExpr, schema.contentSubmissions.mainTheme);

  const map = new Map<string, EdufastMonth>();
  for (const key of keys) {
    map.set(key, {
      month: key,
      label: monthRange(key).shortLabel,
      edufast: 0,
      nonEdufast: 0,
    });
  }
  for (const row of rows) {
    const point = map.get(row.month);
    if (!point) continue;
    if (row.mainTheme === "EDUFAST") point.edufast += toNumber(row.total);
    else point.nonEdufast += toNumber(row.total);
  }
  return keys.map((key) => map.get(key)!);
}

export type MonthlyApprovalPoint = {
  month: string;
  label: string;
  total: number;
};

/** Approved contents per month, always attributed to `approvedAt`. */
export async function getApprovalTrend(
  user: SessionUser,
  filters: AnalyticsChartFilters,
  minimumMonths = 6,
): Promise<MonthlyApprovalPoint[]> {
  const keys = trailingMonthKeys(periodOf(filters), minimumMonths);
  const first = monthRange(keys[0]!);
  const last = monthRange(keys[keys.length - 1]!);
  const monthExpr = sql<string>`to_char(${schema.contentSubmissions.approvedAt}, 'YYYY-MM')`;
  const rows = await getDb()
    .select({ month: monthExpr, total: count() })
    .from(schema.contentSubmissions)
    .where(
      where([
        ...scopeConditions(user, filters),
        eq(schema.contentSubmissions.status, "APPROVED"),
        gte(schema.contentSubmissions.approvedAt, first.startInstant),
        lt(schema.contentSubmissions.approvedAt, last.endInstant),
      ]),
    )
    .groupBy(monthExpr);

  const totals = new Map(rows.map((row) => [row.month, toNumber(row.total)]));
  return keys.map((key) => ({
    month: key,
    label: monthRange(key).shortLabel,
    total: totals.get(key) ?? 0,
  }));
}

export type BenchmarkRow = {
  level: string;
  label: string;
  medianDays: number | null;
  samples: number;
  organizations: number;
  available: boolean;
};

async function benchmarkCohort(
  period: Period,
  condition: SQL | undefined,
  label: string,
  level: string,
): Promise<BenchmarkRow> {
  const days = sql<number>`extract(epoch from (${schema.contentSubmissions.approvedAt} - ${schema.contentSubmissions.submittedAt})) / ${DAY_SECONDS}`;
  const rows = await getDb()
    .select({
      medianDays: sql<number>`percentile_cont(0.5) within group (order by ${days})`,
      samples: count(),
      organizations: countDistinct(schema.stakeholders.id),
    })
    .from(schema.contentSubmissions)
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    )
    .innerJoin(
      schema.branchOffices,
      eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
    )
    .where(
      and(
        ...approvedIn(period),
        isNotNull(schema.contentSubmissions.submittedAt),
        eq(schema.stakeholders.status, "ACTIVE"),
        condition,
      ),
    );

  const row = rows[0];
  const samples = toNumber(row?.samples);
  return {
    level,
    label,
    medianDays:
      row?.medianDays === null || row?.medianDays === undefined
        ? null
        : round(toNumber(row.medianDays)),
    samples,
    organizations: toNumber(row?.organizations),
    available: samples > 0,
  };
}

/**
 * Validation-speed comparison for a single organization against its branch and
 * national cohorts. Cohorts without approved samples stay unavailable instead
 * of rendering a fake zero bar.
 */
export async function getPeerBenchmarks(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): Promise<BenchmarkRow[]> {
  if (user.scope.kind !== "ORG") return [];
  const period = periodOf(filters);
  const contextRows = await getDb()
    .select({
      id: schema.stakeholders.id,
      name: schema.stakeholders.name,
      organizationType: schema.stakeholders.organizationType,
      branchOfficeId: schema.stakeholders.branchOfficeId,
      regionalOfficeId: schema.branchOffices.regionalOfficeId,
    })
    .from(schema.stakeholders)
    .leftJoin(
      schema.branchOffices,
      eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
    )
    .where(eq(schema.stakeholders.id, user.scope.organizationId))
    .limit(1);
  const context = contextRows[0];
  if (!context) return [];

  const peerLabel =
    context.organizationType === "FASKES"
      ? "Faskes sejenis"
      : "Organisasi sejenis";
  const cohorts: Array<{
    condition: SQL | undefined;
    label: string;
    level: string;
  }> = [
    {
      condition: eq(schema.contentSubmissions.stakeholderId, context.id),
      label: context.name,
      level: "organization",
    },
    {
      condition: eq(
        schema.stakeholders.organizationType,
        context.organizationType,
      ),
      label: peerLabel,
      level: "peer",
    },
  ];
  if (context.branchOfficeId) {
    cohorts.push({
      condition: eq(schema.stakeholders.branchOfficeId, context.branchOfficeId),
      label: "Cabang Anda",
      level: "branch",
    });
  }
  if (context.regionalOfficeId) {
    cohorts.push({
      condition: eq(
        schema.branchOffices.regionalOfficeId,
        context.regionalOfficeId,
      ),
      label: "Wilayah Anda",
      level: "region",
    });
  }
  cohorts.push({ condition: undefined, label: "Nasional", level: "national" });

  return Promise.all(
    cohorts.map((cohort) =>
      benchmarkCohort(period, cohort.condition, cohort.label, cohort.level),
    ),
  );
}

export type DashboardAllContentAnalytics = {
  volume: SubmissionVolumePoint[];
  statusCounts: StatusCount[];
  types: NamedSlice[];
  platforms: NamedSlice[];
  aging: AgingBucket[];
  funnel: DecisionFunnel;
  sources: SourceBreakdownRow[];
  sla: SlaRow[];
};

export type DashboardApprovedAnalytics = {
  approvals: MonthlyApprovalPoint[];
  rankings: RankingRow[];
  rankingLabel: string;
  edufast: EdufastMonth[];
  types: NamedSlice[];
  platforms: NamedSlice[];
  benchmarks: BenchmarkRow[];
};

export type DashboardAnalytics = {
  allContent: DashboardAllContentAnalytics;
  approved: DashboardApprovedAnalytics;
};

export type DashboardAnalyticsOptions = {
  rankingLevel?: "branch" | "organization" | null;
};

/**
 * Both dashboard halves in one cached read. The `allContent` half is filtered
 * by creation date and includes every status; the `approved` half is always
 * filtered by `approvedAt` and status APPROVED.
 */
export async function getDashboardAnalytics(
  user: SessionUser,
  filters: AnalyticsChartFilters,
  options: DashboardAnalyticsOptions = {},
): Promise<DashboardAnalytics> {
  const period = periodOf(filters);
  const rankingLevel = options.rankingLevel ?? null;
  const key = readCacheKey(user, [
    "dashboard-analytics",
    period.key,
    filters.attribution,
    filters.stakeholderId,
    filters.subTheme,
    filters.orgType ?? null,
    filters.mainTheme ?? null,
    filters.sources,
    rankingLevel ?? "none",
  ]);

  return cachedRead(key, async () => {
    const [
      volume,
      statusCounts,
      types,
      platforms,
      aging,
      funnel,
      sources,
      sla,
      approvals,
      rankings,
      edufast,
      approvedTypes,
      approvedPlatforms,
      benchmarks,
    ] = await Promise.all([
      getSubmissionVolumeSeries(user, filters),
      getStatusComposition(user, filters),
      getContentTypeMix(user, filters, "all"),
      getPlatformMix(user, filters, "all"),
      getReviewAging(user, filters),
      getDecisionFunnel(user, filters),
      getSourceBreakdown(user, filters),
      getSlaByOrgType(user, filters),
      getApprovalTrend(user, filters),
      rankingLevel
        ? getScopeRankings(user, filters, rankingLevel)
        : Promise.resolve<RankingRow[]>([]),
      getEdufastMonthly(user, filters),
      getContentTypeMix(user, filters, "approved"),
      getPlatformMix(user, filters, "approved"),
      getPeerBenchmarks(user, filters),
    ]);

    return {
      allContent: {
        volume,
        statusCounts,
        types,
        platforms,
        aging,
        funnel,
        sources,
        sla,
      },
      approved: {
        approvals,
        rankings,
        rankingLabel:
          rankingLevel === "branch"
            ? "Peringkat cabang"
            : "Peringkat organisasi",
        edufast,
        types: approvedTypes,
        platforms: approvedPlatforms,
        benchmarks,
      },
    } satisfies DashboardAnalytics;
  });
}
