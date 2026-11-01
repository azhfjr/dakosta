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
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  ORG_SOURCES,
  ORG_SOURCE_LABELS,
  isOrgSource,
  sourceOfOrganization,
  type OrgSource,
} from "@/lib/analytics/source";
import {
  branchScopePredicate,
  contentScopePredicate,
  organizationScopePredicate,
} from "@/lib/authz/predicates";
import { achievementPercent } from "@/lib/kpi/formulas";
import { parsePeriod, periodMonthKeys, type Period } from "@/lib/periods";
import { cachedRead, readCacheKey } from "@/lib/read-cache";
import { assertCapability } from "@/lib/rbac";
import type { SessionUser } from "@/lib/session";

export const PERFORMANCE_SORTS = [
  "name",
  "approved",
  "target",
  "percent",
  "difference",
  "updated",
] as const;
export type PerformanceSort = (typeof PERFORMANCE_SORTS)[number];

export const PERFORMANCE_STATUS_FILTERS = [
  "ALL",
  "MET",
  "BELOW",
  "NO_TARGET",
] as const;
export type PerformanceStatusFilter =
  (typeof PERFORMANCE_STATUS_FILTERS)[number];

export type PerformanceTargetStatus = "MET" | "BELOW" | "NO_TARGET";

export type PerformanceFilters = {
  period: Period;
  branchId: string | null;
  source: OrgSource | null;
  q: string | null;
  status: PerformanceStatusFilter;
  percentMin: number | null;
  percentMax: number | null;
  approvedMin: number | null;
  approvedMax: number | null;
  targetMin: number | null;
  targetMax: number | null;
  sort: PerformanceSort;
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type PerformanceRow = {
  stakeholderId: string;
  name: string;
  faskesCode: string | null;
  source: OrgSource;
  sourceLabel: string;
  branchId: string | null;
  branchName: string | null;
  regionName: string | null;
  target: number | null;
  approved: number;
  difference: number | null;
  achievement: number | null;
  status: PerformanceTargetStatus;
  targetUpdatedAt: Date | null;
  lastApprovedAt: Date | null;
  updatedAt: Date | null;
};

export type PerformanceSummary = {
  institutions: number;
  withTarget: number;
  withoutTarget: number;
  target: number;
  approved: number;
  achievement: number | null;
  met: number;
  below: number;
};

export type PerformanceBranchOption = {
  id: string;
  name: string;
  regionName: string;
};

export type PerformanceTable = {
  filters: PerformanceFilters;
  rows: PerformanceRow[];
  summary: PerformanceSummary;
  branches: PerformanceBranchOption[];
  totalRows: number;
  page: number;
  pageCount: number;
  generatedAt: Date;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAGE_SIZES = [25, 50, 100] as const;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function param(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
  key: string,
): string | undefined {
  return params instanceof URLSearchParams
    ? (params.get(key) ?? undefined)
    : firstValue(params[key]);
}

function numberParam(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) return null;
  return parsed;
}

function integerParam(value: string | undefined): number | null {
  const parsed = numberParam(value);
  return parsed === null ? null : Math.floor(parsed);
}

export function parsePerformanceFilters(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): PerformanceFilters {
  const rawSource = param(params, "type")?.toUpperCase();
  const rawStatus = param(params, "status")?.toUpperCase();
  const rawSort = param(params, "sort");
  const sort = (PERFORMANCE_SORTS as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as PerformanceSort)
    : "approved";
  const rawDirection = param(params, "dir");
  const direction = rawDirection === "asc" ? "asc" : "desc";
  const rawPage = Number(param(params, "page"));
  const rawPageSize = Number(param(params, "pageSize"));
  const q = param(params, "q")?.trim().slice(0, 80) || null;

  return {
    period: parsePeriod(param(params, "period")),
    branchId: UUID_PATTERN.test(param(params, "branch") ?? "")
      ? (param(params, "branch") as string)
      : null,
    source: rawSource && isOrgSource(rawSource) ? rawSource : null,
    q,
    status: (PERFORMANCE_STATUS_FILTERS as readonly string[]).includes(
      rawStatus ?? "",
    )
      ? (rawStatus as PerformanceStatusFilter)
      : "ALL",
    percentMin: numberParam(param(params, "pmin")),
    percentMax: numberParam(param(params, "pmax")),
    approvedMin: integerParam(param(params, "rmin")),
    approvedMax: integerParam(param(params, "rmax")),
    targetMin: integerParam(param(params, "tmin")),
    targetMax: integerParam(param(params, "tmax")),
    sort,
    direction,
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(rawPageSize)
      ? rawPageSize
      : 25,
  };
}

export function buildPerformanceQuery(
  filters: PerformanceFilters,
  overrides: Record<string, string | number | null | undefined> = {},
): string {
  const merged: Record<string, string | number | null | undefined> = {
    period: filters.period.key,
    branch: filters.branchId,
    type: filters.source,
    q: filters.q,
    status: filters.status === "ALL" ? null : filters.status,
    pmin: filters.percentMin,
    pmax: filters.percentMax,
    rmin: filters.approvedMin,
    rmax: filters.approvedMax,
    tmin: filters.targetMin,
    tmax: filters.targetMax,
    sort: filters.sort,
    dir: filters.direction,
    page: filters.page,
    pageSize: filters.pageSize,
    ...overrides,
  };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export async function getPerformanceBranchOptions(
  user: SessionUser,
): Promise<PerformanceBranchOption[]> {
  const scope = branchScopePredicate(user.scope, schema.branchOffices.id);
  const rows = await getDb()
    .select({
      id: schema.branchOffices.id,
      name: schema.branchOffices.name,
      regionName: schema.regionalOffices.name,
    })
    .from(schema.branchOffices)
    .innerJoin(
      schema.regionalOffices,
      eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
    )
    .where(and(eq(schema.branchOffices.status, "ACTIVE"), scope))
    .orderBy(asc(schema.regionalOffices.name), asc(schema.branchOffices.name));
  return rows;
}

function sourceCondition(source: OrgSource): SQL {
  switch (source) {
    case "FASKES_FKTP":
      return and(
        eq(schema.stakeholders.organizationType, "FASKES"),
        eq(schema.stakeholders.faskesClass, "FKTP"),
      )!;
    case "FASKES_FKRTL":
      return and(
        eq(schema.stakeholders.organizationType, "FASKES"),
        eq(schema.stakeholders.faskesClass, "FKRTL"),
      )!;
    case "PEMDA":
      return eq(schema.stakeholders.organizationType, "PEMDA");
    case "OTHER":
      return eq(schema.stakeholders.organizationType, "OTHER");
  }
}

async function queryPerformanceRows(
  user: SessionUser,
  filters: PerformanceFilters,
  options: {
    limit?: number;
    offset?: number;
    includeSummary?: boolean;
  } = {},
): Promise<{
  rows: PerformanceRow[];
  summary: PerformanceSummary;
  totalRows: number;
  lastUpdatedAt: Date | null;
}> {
  const db = getDb();
  const monthStarts = periodMonthKeys(filters.period).map((key) => `${key}-01`);

  // Per DEC-02, an institution target is the monthly target of that
  // institution. Quarter/year values are the sum of its monthly targets. Sub
  // theme targets are never added automatically because that would double count.
  const targetAgg = db
    .select({
      stakeholderId: schema.kpiTargets.stakeholderId,
      target: sql<number>`sum(${schema.kpiTargets.targetCount})`
        .mapWith(Number)
        .as("target"),
      targetUpdatedAt: sql<Date | null>`max(${schema.kpiTargets.updatedAt})`.as(
        "target_updated_at",
      ),
    })
    .from(schema.kpiTargets)
    .where(
      and(
        isNotNull(schema.kpiTargets.stakeholderId),
        isNull(schema.kpiTargets.regionalOfficeId),
        isNull(schema.kpiTargets.branchOfficeId),
        isNull(schema.kpiTargets.themeId),
        isNull(schema.kpiTargets.subTheme),
        inArray(schema.kpiTargets.periodStart, monthStarts),
      ),
    )
    .groupBy(schema.kpiTargets.stakeholderId)
    .as("target_agg");

  const approvedAgg = db
    .select({
      stakeholderId: schema.contentSubmissions.stakeholderId,
      approved: sql<number>`count(distinct ${schema.contentSubmissions.id})`
        .mapWith(Number)
        .as("approved"),
      lastApprovedAt:
        sql<Date | null>`max(${schema.contentSubmissions.approvedAt})`.as(
          "last_approved_at",
        ),
    })
    .from(schema.contentSubmissions)
    .where(
      and(
        eq(schema.contentSubmissions.status, "APPROVED"),
        gte(schema.contentSubmissions.approvedAt, filters.period.start),
        lt(schema.contentSubmissions.approvedAt, filters.period.endExclusive),
        contentScopePredicate(user, schema.contentSubmissions.stakeholderId),
      ),
    )
    .groupBy(schema.contentSubmissions.stakeholderId);

  const approvedAggSubquery = approvedAgg.as("approved_agg");

  const approvedExpr = sql<number>`coalesce(${approvedAggSubquery.approved}, 0)`;
  const percentExpr = sql<
    number | null
  >`case when ${targetAgg.target} > 0 then (coalesce(${approvedAggSubquery.approved}, 0)::numeric / ${targetAgg.target}) * 100 else null end`;

  const conditions: SQL[] = [eq(schema.stakeholders.status, "ACTIVE")];
  const scopeCondition = organizationScopePredicate(user.scope, {
    id: schema.stakeholders.id,
    branchId: schema.stakeholders.branchOfficeId,
  });
  if (scopeCondition) conditions.push(scopeCondition);

  if (filters.branchId) {
    conditions.push(eq(schema.stakeholders.branchOfficeId, filters.branchId));
  }
  if (filters.source) conditions.push(sourceCondition(filters.source));
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    conditions.push(
      or(
        ilike(schema.stakeholders.name, pattern),
        ilike(schema.stakeholders.faskesCode, pattern),
      )!,
    );
  }
  if (filters.percentMin !== null) {
    conditions.push(gte(percentExpr, filters.percentMin));
  }
  if (filters.percentMax !== null) {
    conditions.push(lte(percentExpr, filters.percentMax));
  }
  if (filters.approvedMin !== null) {
    conditions.push(gte(approvedExpr, filters.approvedMin));
  }
  if (filters.approvedMax !== null) {
    conditions.push(lte(approvedExpr, filters.approvedMax));
  }
  if (filters.targetMin !== null) {
    conditions.push(gte(targetAgg.target, filters.targetMin));
  }
  if (filters.targetMax !== null) {
    conditions.push(lte(targetAgg.target, filters.targetMax));
  }
  if (filters.status === "MET") {
    conditions.push(
      sql`${targetAgg.target} > 0 and coalesce(${approvedAggSubquery.approved}, 0) >= ${targetAgg.target}`,
    );
  } else if (filters.status === "BELOW") {
    conditions.push(
      sql`${targetAgg.target} > 0 and coalesce(${approvedAggSubquery.approved}, 0) < ${targetAgg.target}`,
    );
  } else if (filters.status === "NO_TARGET") {
    conditions.push(
      sql`(${targetAgg.target} is null or ${targetAgg.target} <= 0)`,
    );
  }

  const where = and(...conditions);
  const direction =
    filters.direction === "asc" ? sql.raw("asc") : sql.raw("desc");

  let order: SQL[];
  switch (filters.sort) {
    case "name":
      order = [
        filters.direction === "asc"
          ? asc(schema.stakeholders.name)
          : desc(schema.stakeholders.name),
      ];
      break;
    case "target":
      order = [
        sql`${targetAgg.target} ${direction} nulls last`,
        asc(schema.stakeholders.name),
      ];
      break;
    case "percent":
      order = [
        sql`${percentExpr} ${direction} nulls last`,
        asc(schema.stakeholders.name),
      ];
      break;
    case "difference":
      order = [
        sql`(coalesce(${approvedAggSubquery.approved}, 0) - coalesce(${targetAgg.target}, 0)) ${direction}`,
        asc(schema.stakeholders.name),
      ];
      break;
    case "updated":
      order = [
        sql`greatest(${targetAgg.targetUpdatedAt}, ${approvedAggSubquery.lastApprovedAt}) ${direction} nulls last`,
        asc(schema.stakeholders.name),
      ];
      break;
    default:
      order = [
        sql`${approvedExpr} ${direction}`,
        asc(schema.stakeholders.name),
      ];
  }

  const baseQuery = db
    .select({
      id: schema.stakeholders.id,
      name: schema.stakeholders.name,
      faskesCode: schema.stakeholders.faskesCode,
      organizationType: schema.stakeholders.organizationType,
      faskesClass: schema.stakeholders.faskesClass,
      branchId: schema.stakeholders.branchOfficeId,
      branchName: schema.branchOffices.name,
      regionName: schema.regionalOffices.name,
      target: targetAgg.target,
      approved: approvedExpr.mapWith(Number),
      targetUpdatedAt: targetAgg.targetUpdatedAt,
      lastApprovedAt: approvedAggSubquery.lastApprovedAt,
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
    .leftJoin(targetAgg, eq(targetAgg.stakeholderId, schema.stakeholders.id))
    .leftJoin(
      approvedAggSubquery,
      eq(approvedAggSubquery.stakeholderId, schema.stakeholders.id),
    )
    .where(where);

  const summaryQuery = db
    .select({
      institutions: count(),
      withTarget: sql<number>`count(*) filter (where ${targetAgg.target} > 0)`
        .mapWith(Number)
        .as("with_target"),
      target:
        sql<number>`coalesce(sum(case when ${targetAgg.target} > 0 then ${targetAgg.target} else 0 end), 0)`
          .mapWith(Number)
          .as("target_total"),
      approved:
        sql<number>`coalesce(sum(coalesce(${approvedAggSubquery.approved}, 0)), 0)`
          .mapWith(Number)
          .as("approved_total"),
      met: sql<number>`count(*) filter (where ${targetAgg.target} > 0 and coalesce(${approvedAggSubquery.approved}, 0) >= ${targetAgg.target})`
        .mapWith(Number)
        .as("met_total"),
      lastUpdatedAt:
        sql<Date | null>`max(greatest(${targetAgg.targetUpdatedAt}, ${approvedAggSubquery.lastApprovedAt}))`.as(
          "last_updated_at",
        ),
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
    .leftJoin(targetAgg, eq(targetAgg.stakeholderId, schema.stakeholders.id))
    .leftJoin(
      approvedAggSubquery,
      eq(approvedAggSubquery.stakeholderId, schema.stakeholders.id),
    )
    .where(where);

  type SummaryRow = {
    institutions: number;
    withTarget: number;
    target: number;
    approved: number;
    met: number;
    lastUpdatedAt: Date | null;
  };

  const [rows, summaryRows] = await Promise.all([
    baseQuery
      .orderBy(...order)
      .limit(options.limit ?? 25)
      .offset(options.offset ?? 0),
    options.includeSummary === false
      ? Promise.resolve([] as SummaryRow[])
      : Promise.resolve(summaryQuery),
  ]);

  const mapped: PerformanceRow[] = rows.map((row) => {
    const source = sourceOfOrganization(row);
    const target =
      row.target === null || row.target === undefined
        ? null
        : Number(row.target);
    const approved = Number(row.approved ?? 0);
    const targetUpdatedAt = row.targetUpdatedAt
      ? new Date(row.targetUpdatedAt)
      : null;
    const lastApprovedAt = row.lastApprovedAt
      ? new Date(row.lastApprovedAt)
      : null;
    const updatedAt =
      targetUpdatedAt && lastApprovedAt
        ? new Date(
            Math.max(targetUpdatedAt.getTime(), lastApprovedAt.getTime()),
          )
        : (targetUpdatedAt ?? lastApprovedAt);
    return {
      stakeholderId: row.id,
      name: row.name,
      faskesCode: row.faskesCode,
      source,
      sourceLabel: ORG_SOURCE_LABELS[source],
      branchId: row.branchId,
      branchName: row.branchName,
      regionName: row.regionName,
      target,
      approved,
      difference: target === null ? null : approved - target,
      achievement: achievementPercent(approved, target),
      status:
        target === null || target <= 0
          ? "NO_TARGET"
          : approved >= target
            ? "MET"
            : "BELOW",
      targetUpdatedAt,
      lastApprovedAt,
      updatedAt,
    };
  });

  const summaryRow = summaryRows[0];
  const institutions = Number(summaryRow?.institutions ?? 0);
  const withTarget = Number(summaryRow?.withTarget ?? 0);
  const target = Number(summaryRow?.target ?? 0);
  const approved = Number(summaryRow?.approved ?? 0);
  const met = Number(summaryRow?.met ?? 0);
  const lastUpdatedAt = summaryRow?.lastUpdatedAt
    ? new Date(summaryRow.lastUpdatedAt)
    : null;

  return {
    rows: mapped,
    summary: {
      institutions,
      withTarget,
      withoutTarget: institutions - withTarget,
      target,
      approved,
      achievement: achievementPercent(approved, target),
      met,
      below: withTarget - met,
    },
    totalRows: institutions,
    lastUpdatedAt,
  };
}

export async function getPerformanceTable(
  user: SessionUser,
  filters: PerformanceFilters,
): Promise<PerformanceTable> {
  assertCapability(user, "performance:read");
  return cachedRead(
    readCacheKey(user, [
      "performance-table",
      filters.period.key,
      filters.branchId,
      filters.source,
      filters.q,
      filters.status,
      filters.percentMin,
      filters.percentMax,
      filters.approvedMin,
      filters.approvedMax,
      filters.targetMin,
      filters.targetMax,
      filters.sort,
      filters.direction,
      filters.page,
      filters.pageSize,
    ]),
    () => loadPerformanceTable(user, filters),
  );
}

async function loadPerformanceTable(
  user: SessionUser,
  filters: PerformanceFilters,
): Promise<PerformanceTable> {
  const branches = await getPerformanceBranchOptions(user);
  const allowed = new Set(branches.map((branch) => branch.id));
  const branchId =
    filters.branchId && allowed.has(filters.branchId) ? filters.branchId : null;
  const effective: PerformanceFilters = { ...filters, branchId };

  const pageSize = filters.pageSize;
  let page = filters.page;
  let result = await queryPerformanceRows(user, effective, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const pageCount = Math.max(1, Math.ceil(result.totalRows / pageSize));
  if (page > pageCount) {
    page = pageCount;
    result = await queryPerformanceRows(user, effective, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }

  return {
    filters: effective,
    rows: result.rows,
    summary: result.summary,
    branches,
    totalRows: result.totalRows,
    page,
    pageCount,
    generatedAt: new Date(),
  };
}

export async function listPerformanceRows(
  user: SessionUser,
  filters: PerformanceFilters,
): Promise<{ rows: PerformanceRow[]; summary: PerformanceSummary }> {
  assertCapability(user, "performance:export");
  const branches = await getPerformanceBranchOptions(user);
  const allowed = new Set(branches.map((branch) => branch.id));
  const effective: PerformanceFilters = {
    ...filters,
    branchId:
      filters.branchId && allowed.has(filters.branchId)
        ? filters.branchId
        : null,
  };
  const rows: PerformanceRow[] = [];
  let summary: PerformanceSummary | null = null;
  const chunkSize = 1000;
  let offset = 0;
  for (;;) {
    const result = await queryPerformanceRows(user, effective, {
      limit: chunkSize,
      offset,
      includeSummary: offset === 0,
    });
    if (offset === 0) summary = result.summary;
    rows.push(...result.rows);
    if (result.rows.length < chunkSize) break;
    offset += chunkSize;
  }
  return {
    rows,
    summary: summary ?? {
      institutions: rows.length,
      withTarget: 0,
      withoutTarget: rows.length,
      target: 0,
      approved: 0,
      achievement: null,
      met: 0,
      below: 0,
    },
  };
}

export async function getPerformanceSummary(
  user: SessionUser,
  period: Period,
): Promise<PerformanceSummary> {
  assertCapability(user, "performance:read");
  return cachedRead(
    readCacheKey(user, ["performance-summary", period.key]),
    () => loadPerformanceSummary(user, period),
  );
}

async function loadPerformanceSummary(
  user: SessionUser,
  period: Period,
): Promise<PerformanceSummary> {
  const filters: PerformanceFilters = {
    period,
    branchId: null,
    source: null,
    q: null,
    status: "ALL",
    percentMin: null,
    percentMax: null,
    approvedMin: null,
    approvedMax: null,
    targetMin: null,
    targetMax: null,
    sort: "approved",
    direction: "desc",
    page: 1,
    pageSize: 25,
  };
  const result = await queryPerformanceRows(user, filters, {
    limit: 1,
    offset: 0,
    includeSummary: true,
  });
  return result.summary;
}

export function performancePeriodLabel(filters: PerformanceFilters): string {
  return filters.period.label;
}

export function performanceSourceLabel(source: OrgSource | null): string {
  return source ? ORG_SOURCE_LABELS[source] : "Semua jenis instansi";
}

export const PERFORMANCE_SOURCE_OPTIONS = ORG_SOURCES;
