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

import { getDb, schema } from "@/db";
import { contentScopePredicate } from "@/lib/authz/predicates";
import { PENDING_STATUSES, type ContentStatus } from "@/lib/content-status";
import { formatNumberId } from "@/lib/dates";
import {
  monthRange,
  recentMonthKeys,
  type KpiFilters,
} from "@/lib/kpi/formulas";
import type { TargetOverview, TargetScopeSource } from "@/lib/targets";
import { getTargetOverview, resolveTargetAmount } from "@/lib/targets";
import {
  MAIN_THEME_LABELS,
  SUB_THEMES,
  SUB_THEME_LABELS,
  type MainTheme,
  type SubTheme,
} from "@/lib/taxonomy";
import {
  ORG_SOURCE_LABELS,
  orgSourceCondition,
  sourceOfOrganization,
  type OrgSource,
} from "@/lib/analytics/source";
import type { SessionUser } from "@/lib/session";
import { PLATFORM_LABEL } from "@/lib/content-status";

export type AnalyticsChartFilters = KpiFilters & {
  sources: OrgSource[];
};

const DAY_SECONDS = 86_400;

function baseConditions(
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
  return conditions;
}

function monthCondition(
  filters: AnalyticsChartFilters,
  range = monthRange(filters.month),
): SQL {
  return filters.attribution === "approved_at"
    ? and(
        gte(schema.contentSubmissions.approvedAt, range.startInstant),
        lt(schema.contentSubmissions.approvedAt, range.endInstant),
      )!
    : and(
        gte(schema.contentSubmissions.dateCreated, range.startLocal),
        lte(schema.contentSubmissions.dateCreated, range.endLocal),
      )!;
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

export type ContentMixPoint = {
  month: string;
  label: string;
  total: number;
  approved: number;
  video: number;
  infografis: number;
  edufast: number;
  nonEdufast: number;
};

export async function getContentMixSeries(
  user: SessionUser,
  filters: AnalyticsChartFilters,
  months = 6,
): Promise<ContentMixPoint[]> {
  const keys = recentMonthKeys(new Date(), months);
  if (!keys.includes(filters.month)) keys.push(filters.month);
  const sorted = keys.sort();
  const first = monthRange(sorted[0]!);
  const last = monthRange(sorted[sorted.length - 1]!);

  const monthExpr = sql<string>`to_char(${schema.contentSubmissions.dateCreated}, 'YYYY-MM')`;
  const rows = await getDb()
    .select({
      month: monthExpr,
      status: schema.contentSubmissions.status,
      contentType: schema.contentSubmissions.contentType,
      mainTheme: schema.contentSubmissions.mainTheme,
      total: count(),
    })
    .from(schema.contentSubmissions)
    .where(
      where([
        ...baseConditions(user, filters),
        gte(schema.contentSubmissions.dateCreated, first.startLocal),
        lte(schema.contentSubmissions.dateCreated, last.endLocal),
      ]),
    )
    .groupBy(
      monthExpr,
      schema.contentSubmissions.status,
      schema.contentSubmissions.contentType,
      schema.contentSubmissions.mainTheme,
    );

  const points = new Map<string, ContentMixPoint>();
  for (const key of sorted) {
    points.set(key, {
      month: key,
      label: monthRange(key).shortLabel,
      total: 0,
      approved: 0,
      video: 0,
      infografis: 0,
      edufast: 0,
      nonEdufast: 0,
    });
  }
  for (const row of rows) {
    const point = points.get(row.month);
    if (!point) continue;
    const total = toNumber(row.total);
    point.total += total;
    if (row.status === "APPROVED") point.approved += total;
    if (row.contentType === "VIDEO") point.video += total;
    if (row.contentType === "INFOGRAFIS") point.infografis += total;
    if (row.mainTheme === "EDUFAST") point.edufast += total;
    if (row.mainTheme === "NON_EDUFAST") point.nonEdufast += total;
  }
  return sorted.map((key) => points.get(key)!);
}

export type ThemeMatrixRow = {
  mainTheme: MainTheme | "UNKNOWN";
  subTheme: SubTheme | "NONE";
  label: string;
  total: number;
  approved: number;
};

export async function getThemeMatrix(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): Promise<ThemeMatrixRow[]> {
  const rows = await getDb()
    .select({
      mainTheme: schema.contentSubmissions.mainTheme,
      subTheme: schema.contentSubmissions.subTheme,
      status: schema.contentSubmissions.status,
      total: count(),
    })
    .from(schema.contentSubmissions)
    .where(where([...baseConditions(user, filters), monthCondition(filters)]))
    .groupBy(
      schema.contentSubmissions.mainTheme,
      schema.contentSubmissions.subTheme,
      schema.contentSubmissions.status,
    );

  const grouped = new Map<string, ThemeMatrixRow>();
  for (const row of rows) {
    const mainTheme =
      row.mainTheme === "EDUFAST" || row.mainTheme === "NON_EDUFAST"
        ? row.mainTheme
        : "UNKNOWN";
    const subTheme = SUB_THEMES.includes(row.subTheme as SubTheme)
      ? (row.subTheme as SubTheme)
      : "NONE";
    const key = `${mainTheme}:${subTheme}`;
    const current = grouped.get(key) ?? {
      mainTheme,
      subTheme,
      label:
        mainTheme === "UNKNOWN"
          ? MAIN_THEME_LABELS.EDUFAST
          : subTheme === "NONE"
            ? "Tanpa sub-tema"
            : SUB_THEME_LABELS[subTheme],
      total: 0,
      approved: 0,
    };
    const total = toNumber(row.total);
    current.total += total;
    if (row.status === "APPROVED") current.approved += total;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((a, b) => b.total - a.total);
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
  const range = monthRange(filters.month);
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
        ...baseConditions(user, filters),
        eq(schema.contentSubmissions.status, "APPROVED"),
        isNotNull(schema.contentSubmissions.submittedAt),
        isNotNull(schema.contentSubmissions.approvedAt),
        gte(schema.contentSubmissions.approvedAt, range.startInstant),
        lt(schema.contentSubmissions.approvedAt, range.endInstant),
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

export type AgingBucket = { bucket: string; label: string; total: number };

export async function getReviewAging(
  user: SessionUser,
): Promise<AgingBucket[]> {
  const rows = await getDb()
    .select({ submittedAt: schema.contentSubmissions.submittedAt })
    .from(schema.contentSubmissions)
    .where(
      where([
        ...baseConditions(user, {
          month: "",
          attribution: "date_created",
          stakeholderId: null,
          subTheme: null,
          sources: [],
        }),
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
    const days = Math.max(0, (now - row.submittedAt.getTime()) / 86_400_000);
    const index = days < 3 ? 0 : days < 8 ? 1 : days < 15 ? 2 : 3;
    buckets[index]!.total += 1;
  }
  return buckets;
}

export type FunnelStage = { stage: string; label: string; total: number };

export async function getApprovalFunnel(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): Promise<FunnelStage[]> {
  const rows = await getDb()
    .select({
      status: schema.contentSubmissions.status,
      total: count(),
    })
    .from(schema.contentSubmissions)
    .where(where([...baseConditions(user, filters), monthCondition(filters)]))
    .groupBy(schema.contentSubmissions.status);

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.status, toNumber(row.total));
  const total = rows.reduce((sum, row) => sum + toNumber(row.total), 0);
  const submittedStatuses: ContentStatus[] = [
    "SUBMITTED",
    "RESUBMITTED",
    "IN_REVIEW",
    "APPROVED",
    "REVISION_REQUIRED",
    "REJECTED",
    "REVOKED",
  ];
  const submitted = submittedStatuses.reduce(
    (sum, status) => sum + (counts.get(status) ?? 0),
    0,
  );
  const reviewedStatuses: ContentStatus[] = [
    "IN_REVIEW",
    "APPROVED",
    "REVISION_REQUIRED",
    "REJECTED",
    "REVOKED",
  ];
  const reviewed = reviewedStatuses.reduce(
    (sum, status) => sum + (counts.get(status) ?? 0),
    0,
  );
  return [
    { stage: "created", label: "Konten dibuat", total },
    { stage: "submitted", label: "Dikirim", total: submitted },
    { stage: "reviewed", label: "Diputuskan", total: reviewed },
    {
      stage: "approved",
      label: "Disetujui",
      total: counts.get("APPROVED") ?? 0,
    },
    { stage: "revoked", label: "Dicabut", total: counts.get("REVOKED") ?? 0 },
  ];
}

export type RankingRow = { id: string; name: string; total: number };

export async function getScopeRankings(
  user: SessionUser,
  filters: AnalyticsChartFilters,
  level: "branch" | "organization",
  limit = 8,
): Promise<RankingRow[]> {
  const range = monthRange(filters.month);
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
    .where(
      where([
        ...baseConditions(user, filters),
        eq(schema.contentSubmissions.status, "APPROVED"),
        gte(schema.contentSubmissions.approvedAt, range.startInstant),
        lt(schema.contentSubmissions.approvedAt, range.endInstant),
      ]),
    )
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
  submitted: number;
  organizations: number;
};

export async function getSourceBreakdown(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): Promise<SourceBreakdownRow[]> {
  const range = monthRange(filters.month);
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
    .where(
      where([
        ...baseConditions(user, filters),
        gte(schema.contentSubmissions.approvedAt, range.startInstant),
        lt(schema.contentSubmissions.approvedAt, range.endInstant),
      ]),
    )
    .groupBy(
      schema.stakeholders.organizationType,
      schema.stakeholders.faskesClass,
      schema.contentSubmissions.stakeholderId,
      schema.contentSubmissions.status,
    );

  const grouped = new Map<
    OrgSource,
    { approved: number; submitted: number; organizations: Set<string> }
  >();
  for (const row of rows) {
    const source = sourceOfOrganization(row);
    const current = grouped.get(source) ?? {
      approved: 0,
      submitted: 0,
      organizations: new Set<string>(),
    };
    const total = toNumber(row.total);
    if (row.status === "APPROVED") current.approved += total;
    if (row.status !== "DRAFT") current.submitted += total;
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
  months = 6,
): Promise<EdufastMonth[]> {
  const keys = recentMonthKeys(new Date(), months);
  if (!keys.includes(filters.month)) keys.push(filters.month);
  const sorted = keys.sort();
  const range = monthRange(sorted[sorted.length - 1]!);
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
        ...baseConditions(user, filters),
        eq(schema.contentSubmissions.status, "APPROVED"),
        gte(
          schema.contentSubmissions.approvedAt,
          monthRange(sorted[0]!).startInstant,
        ),
        lt(schema.contentSubmissions.approvedAt, range.endInstant),
      ]),
    )
    .groupBy(monthExpr, schema.contentSubmissions.mainTheme);

  const map = new Map<string, EdufastMonth>();
  for (const key of sorted) {
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
  return sorted.map((key) => map.get(key)!);
}

export type NamedSlice = { key: string; label: string; total: number };

export async function getPlatformMix(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): Promise<NamedSlice[]> {
  const rows = await getDb()
    .select({
      platform: schema.contentSubmissions.platform,
      total: count(),
    })
    .from(schema.contentSubmissions)
    .where(where([...baseConditions(user, filters), monthCondition(filters)]))
    .groupBy(schema.contentSubmissions.platform)
    .orderBy(desc(count()));

  return rows.map((row) => ({
    key: row.platform,
    label: PLATFORM_LABEL[row.platform] ?? row.platform,
    total: toNumber(row.total),
  }));
}

export type StakeholderContext = {
  id: string;
  name: string;
  organizationType: "FASKES" | "PEMDA" | "OTHER";
  faskesClass: string | null;
  category: string;
  serviceArea: string;
  branchId: string | null;
  branchName: string | null;
  regionId: string | null;
  regionName: string | null;
  source: OrgSource;
};

export async function getStakeholderContext(
  user: SessionUser,
): Promise<StakeholderContext | null> {
  if (user.scope.kind !== "ORG") return null;
  const rows = await getDb()
    .select({
      id: schema.stakeholders.id,
      name: schema.stakeholders.name,
      organizationType: schema.stakeholders.organizationType,
      faskesClass: schema.stakeholders.faskesClass,
      category: schema.stakeholders.category,
      serviceArea: schema.stakeholders.serviceArea,
      branchId: schema.stakeholders.branchOfficeId,
      branchName: schema.branchOffices.name,
      regionId: schema.branchOffices.regionalOfficeId,
      regionName: schema.regionalOffices.name,
    })
    .from(schema.stakeholders)
    .leftJoin(
      schema.branchOffices,
      eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
    )
    .leftJoin(
      schema.regionalOffices,
      eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
    )
    .where(eq(schema.stakeholders.id, user.scope.organizationId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    organizationType:
      row.organizationType as StakeholderContext["organizationType"],
    source: sourceOfOrganization(row),
  };
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
  month: string,
  condition: SQL | undefined,
  label: string,
  level: string,
): Promise<BenchmarkRow> {
  const range = monthRange(month);
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
    .where(
      and(
        eq(schema.contentSubmissions.status, "APPROVED"),
        isNotNull(schema.contentSubmissions.submittedAt),
        isNotNull(schema.contentSubmissions.approvedAt),
        gte(schema.contentSubmissions.approvedAt, range.startInstant),
        lt(schema.contentSubmissions.approvedAt, range.endInstant),
        eq(schema.stakeholders.status, "ACTIVE"),
        condition,
      ),
    );

  const row = rows[0];
  const organizations = toNumber(row?.organizations);
  return {
    level,
    label,
    medianDays:
      organizations >= 3 && row?.medianDays !== null
        ? round(toNumber(row?.medianDays))
        : null,
    samples: toNumber(row?.samples),
    organizations,
    available: organizations >= 3,
  };
}

export async function getPeerBenchmarks(
  user: SessionUser,
  filters: AnalyticsChartFilters,
): Promise<{ context: StakeholderContext | null; rows: BenchmarkRow[] }> {
  const context = await getStakeholderContext(user);
  if (!context) return { context: null, rows: [] };

  const typeMatch = and(
    eq(schema.stakeholders.organizationType, context.organizationType),
    context.faskesClass
      ? eq(schema.stakeholders.faskesClass, context.faskesClass)
      : sql`true`,
  );
  const cohortLabel = context.faskesClass
    ? `${context.faskesClass}`
    : context.organizationType === "PEMDA"
      ? "Pemda"
      : "Stakeholder/Mitra";

  const rows = await Promise.all([
    context.branchId
      ? benchmarkCohort(
          filters.month,
          and(
            typeMatch,
            eq(schema.stakeholders.branchOfficeId, context.branchId),
          ),
          `${cohortLabel} di cabang`,
          "branch",
        )
      : Promise.resolve({
          level: "branch",
          label: `${cohortLabel} di cabang`,
          medianDays: null,
          samples: 0,
          organizations: 0,
          available: false,
        }),
    context.regionId
      ? benchmarkCohort(
          filters.month,
          and(
            typeMatch,
            inArray(
              schema.stakeholders.branchOfficeId,
              getDb()
                .select({ id: schema.branchOffices.id })
                .from(schema.branchOffices)
                .where(
                  eq(schema.branchOffices.regionalOfficeId, context.regionId),
                ),
            ),
          ),
          `${cohortLabel} di wilayah`,
          "region",
        )
      : Promise.resolve({
          level: "region",
          label: `${cohortLabel} di wilayah`,
          medianDays: null,
          samples: 0,
          organizations: 0,
          available: false,
        }),
    benchmarkCohort(
      filters.month,
      typeMatch,
      `${cohortLabel} nasional`,
      "national",
    ),
    context.branchId
      ? benchmarkCohort(
          filters.month,
          eq(schema.stakeholders.branchOfficeId, context.branchId),
          "Semua tipe di cabang",
          "branch-all",
        )
      : Promise.resolve({
          level: "branch-all",
          label: "Semua tipe di cabang",
          medianDays: null,
          samples: 0,
          organizations: 0,
          available: false,
        }),
  ]);

  return { context, rows };
}

export type AnalyticsBundle = {
  mix: ContentMixPoint[];
  themes: ThemeMatrixRow[];
  sla: SlaRow[];
  aging: AgingBucket[];
  funnel: FunnelStage[];
  rankings: RankingRow[];
  sources: SourceBreakdownRow[];
  edufast: EdufastMonth[];
  platforms: NamedSlice[];
  targets: TargetOverview;
  context: StakeholderContext | null;
  benchmarks: { context: StakeholderContext | null; rows: BenchmarkRow[] };
};

export async function getAnalyticsBundle(
  user: SessionUser,
  filters: AnalyticsChartFilters,
  options: { rankings?: "branch" | "organization" } = {},
): Promise<AnalyticsBundle> {
  const [
    mix,
    themes,
    sla,
    aging,
    funnel,
    rankings,
    sources,
    edufast,
    platforms,
    targets,
    benchmarks,
  ] = await Promise.all([
    getContentMixSeries(user, filters),
    getThemeMatrix(user, filters),
    getSlaByOrgType(user, filters),
    getReviewAging(user),
    getApprovalFunnel(user, filters),
    options.rankings
      ? getScopeRankings(user, filters, options.rankings)
      : Promise.resolve([]),
    getSourceBreakdown(user, filters),
    getEdufastMonthly(user, filters),
    getPlatformMix(user, filters),
    user.scope.kind === "ORG"
      ? getTargetOverview(filters.month, {
          stakeholderId: user.scope.organizationId,
        })
      : getTargetOverview(filters.month, { pageSize: 0 }),
    getPeerBenchmarks(user, filters),
  ]);

  return {
    mix,
    themes,
    sla,
    aging,
    funnel,
    rankings,
    sources,
    edufast,
    platforms,
    targets,
    context: benchmarks.context,
    benchmarks,
  };
}

/**
 * Ordered fallback for a single organization: pair target, organization target,
 * sub-theme target, then the global workspace target.
 */
export function resolveStakeholderTarget(
  targets: TargetOverview,
  organizationId: string,
  subTheme: string | null,
): {
  value: number;
  target: number | null;
  achievement: number | null;
  source: TargetScopeSource | null;
} {
  const keys = targets.rows.map((row) => ({
    stakeholderId: row.stakeholderId,
    themeId: row.themeId,
    subTheme: row.subTheme,
    targetCount: row.targetCount,
  }));
  const candidates: Array<{
    stakeholderId: string | null;
    subTheme: string | null;
  }> = [];
  if (subTheme) candidates.push({ stakeholderId: organizationId, subTheme });
  candidates.push({ stakeholderId: organizationId, subTheme: null });
  if (subTheme) candidates.push({ stakeholderId: null, subTheme });
  candidates.push({ stakeholderId: null, subTheme: null });

  for (const candidate of candidates) {
    const resolved = resolveTargetAmount(keys, candidate);
    if (resolved.source) {
      return {
        value: 0,
        target: resolved.target,
        achievement: null,
        source: resolved.source,
      };
    }
  }
  return { value: 0, target: null, achievement: null, source: null };
}

export function formatChartPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${formatNumberId(Math.round(value * 10) / 10)}%`;
}

export function sourceLabel(source: OrgSource): string {
  return ORG_SOURCE_LABELS[source];
}
