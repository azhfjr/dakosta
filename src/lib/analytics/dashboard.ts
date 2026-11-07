import "server-only";

import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb, schema } from "@/db";
import { approvedContentCondition } from "@/lib/analytics/approved";
import {
  ANALYTICS_SORT_LABELS,
  listAnalyticsContents,
  type AnalyticsContentFilters,
  type AnalyticsContentPage,
  type AnalyticsSort,
} from "@/lib/analytics/content-table";
import { contentScopePredicate } from "@/lib/authz/predicates";
import { PLATFORM_LABEL } from "@/lib/content-status";
import { getDashboardMap, type DashboardMap } from "@/lib/dashboard-map";
import { ORG_TYPE_FILTER_LABELS } from "@/lib/filters/org-type";
import {
  firstParam,
  parseFilterContentType,
  parseFilterDate,
  parseFilterMainTheme,
  parseFilterOrgType,
  parseFilterPage,
  parseFilterPlatform,
  parseFilterSearch,
  parseFilterSort,
  parseFilterSubTheme,
  parseFilterUuid,
  type FilterParams,
} from "@/lib/filters/query";
import { monthKeyFor, monthRange, previousMonthKey } from "@/lib/kpi/formulas";
import type { SessionUser } from "@/lib/session";
import {
  CONTENT_TYPE_LABELS,
  MAIN_THEME_LABELS,
  SUB_THEMES,
  SUB_THEME_LABELS,
  type ContentType,
} from "@/lib/taxonomy";

export const DASHBOARD_TREND_MONTHS = 24;
export const DASHBOARD_TREND_DEFAULT = 12;
export const DASHBOARD_RANKING_LIMIT = 10;
export const DASHBOARD_RANKING_LIMIT_MAX = 50;

const DASHBOARD_SORTS = [
  "approved_recent",
  "approved_oldest",
  "title",
  "organization",
  "decision",
  "recent",
  "oldest",
  "status",
] as const satisfies readonly AnalyticsSort[];

export type DashboardContentSort = (typeof DASHBOARD_SORTS)[number];

export type ApprovedDashboardFilters = {
  table: AnalyticsContentFilters;
  rankingSearch: string;
  rankingLimit: number;
};

export function parseApprovedDashboardFilters(
  params: FilterParams,
): ApprovedDashboardFilters {
  const rawLimit = Number(firstParam(params, "rankLimit"));
  const rankingLimit =
    Number.isFinite(rawLimit) && rawLimit >= 5
      ? Math.min(DASHBOARD_RANKING_LIMIT_MAX, Math.floor(rawLimit))
      : DASHBOARD_RANKING_LIMIT;

  return {
    rankingSearch: parseFilterSearch(firstParam(params, "rankQ")),
    rankingLimit,
    table: {
      period: "ALL",
      periodBasis: "approved",
      status: "ALL",
      scope: "approved",
      sources: [],
      stakeholderId: parseFilterUuid(firstParam(params, "stakeholderId")),
      branchId: parseFilterUuid(firstParam(params, "branchId")),
      orgType: parseFilterOrgType(firstParam(params, "orgType")),
      mainTheme: parseFilterMainTheme(firstParam(params, "mainTheme")),
      subTheme: parseFilterSubTheme(firstParam(params, "subTheme")),
      contentType: parseFilterContentType(firstParam(params, "type")),
      platform: parseFilterPlatform(firstParam(params, "platform")),
      dateFrom: parseFilterDate(firstParam(params, "from")),
      dateTo: parseFilterDate(firstParam(params, "to")),
      decidedBy: "ANY",
      sort: parseFilterSort(
        firstParam(params, "sort"),
        DASHBOARD_SORTS,
        "approved_recent",
      ),
      search: parseFilterSearch(firstParam(params, "q")),
      page: parseFilterPage(firstParam(params, "page")),
    },
  };
}

/** Shareable query for the approved dashboard table filters. */
export function approvedDashboardQuery(
  filters: ApprovedDashboardFilters,
): Record<string, string> {
  const table = filters.table;
  const query: Record<string, string> = {};
  if (table.search) query.q = table.search;
  if (table.stakeholderId) query.stakeholderId = table.stakeholderId;
  if (table.branchId) query.branchId = table.branchId;
  if (table.orgType) query.orgType = table.orgType;
  if (table.mainTheme) query.mainTheme = table.mainTheme;
  if (table.subTheme) query.subTheme = table.subTheme;
  if (table.contentType) query.type = table.contentType;
  if (table.platform) query.platform = table.platform;
  if (table.dateFrom) query.from = table.dateFrom;
  if (table.dateTo) query.to = table.dateTo;
  if (table.sort !== "approved_recent") query.sort = table.sort;
  if (table.page > 1) query.page = String(table.page);
  return query;
}

export type DashboardTotals = {
  approved: number;
  thisMonth: number;
  lastMonth: number;
  growth: number | null;
  organizations: number;
  branches: number;
};

export type DashboardRankingRow = {
  rank: number;
  id: string;
  name: string;
  organizationType: string;
  categoryLabel: string;
  detail: string;
  approved: number;
};

export type DashboardRankingCategory = {
  key: string;
  label: string;
  approved: number;
  institutions: number;
};

export type DashboardRanking = {
  rows: DashboardRankingRow[];
  shown: number;
  total: number;
  hasMore: boolean;
  categories: DashboardRankingCategory[];
};

export type DashboardBranchRow = {
  rank: number;
  id: string;
  name: string;
  regionName: string;
  approved: number;
  institutions: number;
};

export type DashboardBranchAchievement = {
  rows: DashboardBranchRow[];
  total: number;
  hasMore: boolean;
};

export type DashboardMonthlyPoint = {
  month: string;
  label: string;
  total: number;
};

export type DashboardThemePoint = {
  month: string;
  label: string;
  edufast: number;
  nonEdufast: number;
};

export type DashboardSubThemeRow = {
  key: string;
  label: string;
  total: number;
  orphan: boolean;
};

export type DashboardTypePlatformPoint = {
  month: string;
  label: string;
  total: number;
  types: Record<string, number>;
  platforms: Record<string, number>;
};

export type DashboardBreakdownRow = {
  key: string;
  label: string;
  total: number;
};

export type DashboardTypePlatform = {
  monthly: DashboardTypePlatformPoint[];
  types: DashboardBreakdownRow[];
  platforms: DashboardBreakdownRow[];
};

export type ApprovedDashboard = {
  totals: DashboardTotals;
  branchAchievement: DashboardBranchAchievement | null;
  map: DashboardMap;
  ranking: DashboardRanking;
  monthly: DashboardMonthlyPoint[];
  theme: {
    monthly: DashboardThemePoint[];
    subThemes: DashboardSubThemeRow[];
    orphanTotal: number;
  };
  typePlatform: DashboardTypePlatform;
  table: AnalyticsContentPage;
  generatedAt: Date;
};

const ORPHAN_KEY = "TANPA_SUB_TEMA";

function approvedScope(user: SessionUser): SQL[] {
  const conditions: SQL[] = [approvedContentCondition()];
  const scope = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  if (scope) conditions.push(scope);
  return conditions;
}

export function dashboardTrendWindow(count = DASHBOARD_TREND_MONTHS): {
  keys: string[];
  start: Date;
  end: Date;
} {
  const current = monthKeyFor();
  const keys = [current];
  let cursor = current;
  for (let index = 1; index < count; index += 1) {
    cursor = previousMonthKey(cursor);
    keys.push(cursor);
  }
  // Resolve the earliest bucket before reversing so the range stays 24 months.
  const start = monthRange(keys[keys.length - 1]!).startInstant;
  return {
    keys: keys.reverse(),
    start,
    end: monthRange(current).endInstant,
  };
}

function rankRows<T extends { approved: number }>(
  rows: T[],
): (T & { rank: number })[] {
  const decorated: (T & { rank: number })[] = [];
  rows.forEach((row, index) => {
    const previous = decorated[index - 1];
    const rank =
      previous && previous.approved === row.approved
        ? previous.rank
        : index + 1;
    decorated.push({ ...row, rank });
  });
  return decorated;
}

function growthPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function categoryLabel(organizationType: string): string {
  return (
    ORG_TYPE_FILTER_LABELS[
      organizationType as keyof typeof ORG_TYPE_FILTER_LABELS
    ] ?? "Stakeholder lainnya"
  );
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

async function loadTotals(scope: SQL[]): Promise<DashboardTotals> {
  const currentKey = monthKeyFor();
  const previousKey = previousMonthKey(currentKey);
  const current = monthRange(currentKey);
  const previous = monthRange(previousKey);
  const approvedAt = schema.contentSubmissions.approvedAt;

  const [row] = await getDb()
    .select({
      approved: count(),
      organizations: countDistinct(schema.contentSubmissions.stakeholderId),
      branches: countDistinct(schema.stakeholders.branchOfficeId),
      thisMonth:
        sql<number>`count(*) filter (where ${approvedAt} >= ${current.startInstant} and ${approvedAt} < ${current.endInstant})`.mapWith(
          Number,
        ),
      lastMonth:
        sql<number>`count(*) filter (where ${approvedAt} >= ${previous.startInstant} and ${approvedAt} < ${previous.endInstant})`.mapWith(
          Number,
        ),
    })
    .from(schema.contentSubmissions)
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    )
    .where(and(...scope));

  const thisMonth = Number(row?.thisMonth ?? 0);
  const lastMonth = Number(row?.lastMonth ?? 0);
  return {
    approved: Number(row?.approved ?? 0),
    thisMonth,
    lastMonth,
    growth: growthPercent(thisMonth, lastMonth),
    organizations: Number(row?.organizations ?? 0),
    branches: Number(row?.branches ?? 0),
  };
}

async function loadRanking(
  user: SessionUser,
  scope: SQL[],
  search: string,
  limit: number,
): Promise<DashboardRanking> {
  const db = getDb();
  const conditions = [...scope];
  if (search) {
    conditions.push(ilike(schema.stakeholders.name, `%${escapeLike(search)}%`));
  }
  const where = and(...conditions);
  const approvedExpr = count(schema.contentSubmissions.id);

  const [rows, totals, categories] = await Promise.all([
    db
      .select({
        id: schema.stakeholders.id,
        name: schema.stakeholders.name,
        organizationType: schema.stakeholders.organizationType,
        category: schema.stakeholders.category,
        branchName: schema.branchOffices.name,
        approved: approvedExpr.mapWith(Number),
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
      .where(where)
      .groupBy(
        schema.stakeholders.id,
        schema.stakeholders.name,
        schema.stakeholders.organizationType,
        schema.stakeholders.category,
        schema.branchOffices.name,
      )
      .orderBy(desc(approvedExpr), asc(schema.stakeholders.name))
      .limit(limit + 1),
    db
      .select({ total: countDistinct(schema.contentSubmissions.stakeholderId) })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(where),
    db
      .select({
        organizationType: schema.stakeholders.organizationType,
        approved: count().mapWith(Number),
        institutions: countDistinct(schema.contentSubmissions.stakeholderId),
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(where)
      .groupBy(schema.stakeholders.organizationType),
  ]);

  const total = Number(totals[0]?.total ?? 0);
  const decorated = rankRows(
    rows.slice(0, limit).map((row) => ({
      id: row.id,
      name: row.name,
      organizationType: row.organizationType,
      categoryLabel: categoryLabel(row.organizationType),
      detail: row.branchName ?? row.category ?? "",
      approved: Number(row.approved),
    })),
  );

  return {
    rows: decorated,
    shown: decorated.length,
    total,
    hasMore: rows.length > limit,
    categories: categories
      .map((row) => ({
        key: row.organizationType,
        label: categoryLabel(row.organizationType),
        approved: Number(row.approved),
        institutions: Number(row.institutions),
      }))
      .sort((left, right) => right.approved - left.approved),
  };
}

async function loadBranchAchievement(
  user: SessionUser,
  scope: SQL[],
): Promise<DashboardBranchAchievement | null> {
  if (user.role !== "REGIONAL_ADMIN") return null;
  const approvedExpr = count(schema.contentSubmissions.id);
  const rows = await getDb()
    .select({
      id: schema.branchOffices.id,
      name: schema.branchOffices.name,
      regionName: schema.regionalOffices.name,
      approved: approvedExpr.mapWith(Number),
      institutions: countDistinct(schema.contentSubmissions.stakeholderId),
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
    .innerJoin(
      schema.regionalOffices,
      eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
    )
    .where(and(...scope))
    .groupBy(
      schema.branchOffices.id,
      schema.branchOffices.name,
      schema.regionalOffices.name,
    )
    .orderBy(desc(approvedExpr), asc(schema.branchOffices.name));

  const decorated = rankRows(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      regionName: row.regionName,
      approved: Number(row.approved),
      institutions: Number(row.institutions),
    })),
  );

  return {
    rows: decorated,
    total: decorated.length,
    hasMore: false,
  };
}

function monthExpr() {
  return sql<string>`to_char(${schema.contentSubmissions.approvedAt} at time zone 'Asia/Jakarta', 'YYYY-MM')`;
}

async function loadMonthlyTrend(scope: SQL[]): Promise<{
  monthly: DashboardMonthlyPoint[];
  themeMonthly: DashboardThemePoint[];
  subThemes: DashboardSubThemeRow[];
  monthlyTypes: DashboardTypePlatformPoint[];
}> {
  const window = dashboardTrendWindow();
  const where = and(
    ...scope,
    gte(schema.contentSubmissions.approvedAt, window.start),
    lte(schema.contentSubmissions.approvedAt, window.end),
  );
  const month = monthExpr();

  const [monthRows, themeRows, subThemeRows] = await Promise.all([
    getDb()
      .select({ month, total: count().mapWith(Number) })
      .from(schema.contentSubmissions)
      .where(where)
      .groupBy(month),
    getDb()
      .select({
        month,
        mainTheme: schema.contentSubmissions.mainTheme,
        total: count().mapWith(Number),
      })
      .from(schema.contentSubmissions)
      .where(where)
      .groupBy(month, schema.contentSubmissions.mainTheme),
    getDb()
      .select({
        subTheme: schema.contentSubmissions.subTheme,
        total: count().mapWith(Number),
      })
      .from(schema.contentSubmissions)
      .where(where)
      .groupBy(schema.contentSubmissions.subTheme),
  ]);

  const monthlyMap = new Map(
    monthRows.map((row) => [row.month, Number(row.total)]),
  );
  const themeMap = new Map<string, { edufast: number; nonEdufast: number }>();
  for (const row of themeRows) {
    const entry = themeMap.get(row.month) ?? { edufast: 0, nonEdufast: 0 };
    if (row.mainTheme === "EDUFAST") entry.edufast += Number(row.total);
    else entry.nonEdufast += Number(row.total);
    themeMap.set(row.month, entry);
  }

  let orphanTotal = 0;
  const subThemeTotals = new Map<string, number>();
  for (const row of subThemeRows) {
    const total = Number(row.total);
    if (
      row.subTheme &&
      (SUB_THEMES as readonly string[]).includes(row.subTheme)
    ) {
      subThemeTotals.set(
        row.subTheme,
        (subThemeTotals.get(row.subTheme) ?? 0) + total,
      );
    } else {
      orphanTotal += total;
    }
  }

  const subThemes: DashboardSubThemeRow[] = [
    ...SUB_THEMES.map((key) => ({
      key,
      label: SUB_THEME_LABELS[key],
      total: subThemeTotals.get(key) ?? 0,
      orphan: false,
    })),
    {
      key: ORPHAN_KEY,
      label: "Tanpa sub-tema / tidak dikenali",
      total: orphanTotal,
      orphan: true,
    },
  ].filter((row) => row.total > 0 || !row.orphan);

  const typeRows = await getDb()
    .select({
      month,
      contentType: schema.contentSubmissions.contentType,
      platform: schema.contentSubmissions.platform,
      total: count().mapWith(Number),
    })
    .from(schema.contentSubmissions)
    .where(where)
    .groupBy(
      month,
      schema.contentSubmissions.contentType,
      schema.contentSubmissions.platform,
    );

  const monthlyTypes: DashboardTypePlatformPoint[] = window.keys.map((key) => ({
    month: key,
    label: monthRange(key).shortLabel,
    total: monthlyMap.get(key) ?? 0,
    types: {},
    platforms: {},
  }));
  const byMonth = new Map(monthlyTypes.map((point) => [point.month, point]));
  for (const row of typeRows) {
    const point = byMonth.get(row.month);
    if (!point) continue;
    const total = Number(row.total);
    const typeKey = row.contentType ?? "TANPA_JENIS";
    const platformKey = row.platform ?? "TANPA_PLATFORM";
    point.types[typeKey] = (point.types[typeKey] ?? 0) + total;
    point.platforms[platformKey] = (point.platforms[platformKey] ?? 0) + total;
  }

  return {
    monthly: window.keys.map((key) => ({
      month: key,
      label: monthRange(key).shortLabel,
      total: monthlyMap.get(key) ?? 0,
    })),
    themeMonthly: window.keys.map((key) => ({
      month: key,
      label: monthRange(key).shortLabel,
      edufast: themeMap.get(key)?.edufast ?? 0,
      nonEdufast: themeMap.get(key)?.nonEdufast ?? 0,
    })),
    subThemes,
    monthlyTypes,
  };
}

function breakdown(
  points: DashboardTypePlatformPoint[],
  field: "types" | "platforms",
  labelFor: (key: string) => string,
): DashboardBreakdownRow[] {
  const totals = new Map<string, number>();
  for (const point of points) {
    for (const [key, value] of Object.entries(point[field])) {
      totals.set(key, (totals.get(key) ?? 0) + value);
    }
  }
  return [...totals.entries()]
    .map(([key, total]) => ({ key, label: labelFor(key), total }))
    .sort((left, right) => right.total - left.total);
}

function typeLabel(key: string): string {
  return (
    CONTENT_TYPE_LABELS[key as ContentType] ??
    (key === "TANPA_JENIS" ? "Tanpa jenis" : key)
  );
}

function platformLabel(key: string): string {
  if (key === "TANPA_PLATFORM") return "Tanpa platform";
  return PLATFORM_LABEL[key as keyof typeof PLATFORM_LABEL] ?? key;
}

export async function getApprovedDashboard(
  user: SessionUser,
  filters: ApprovedDashboardFilters,
): Promise<ApprovedDashboard> {
  const scope = approvedScope(user);
  const [totals, ranking, branchAchievement, trend, map, table] =
    await Promise.all([
      loadTotals(scope),
      loadRanking(user, scope, filters.rankingSearch, filters.rankingLimit),
      loadBranchAchievement(user, scope),
      loadMonthlyTrend(scope),
      getDashboardMap(user, {
        period: null,
        stakeholderId: filters.table.stakeholderId,
        subTheme: filters.table.subTheme,
      }),
      listAnalyticsContents(user, filters.table),
    ]);

  return {
    totals,
    branchAchievement,
    map,
    ranking,
    monthly: trend.monthly,
    theme: {
      monthly: trend.themeMonthly,
      subThemes: trend.subThemes,
      orphanTotal: trend.subThemes.find((row) => row.orphan)?.total ?? 0,
    },
    typePlatform: {
      monthly: trend.monthlyTypes,
      types: breakdown(trend.monthlyTypes, "types", typeLabel),
      platforms: breakdown(trend.monthlyTypes, "platforms", platformLabel),
    },
    table,
    generatedAt: new Date(),
  };
}

export const DASHBOARD_SORT_LABELS = ANALYTICS_SORT_LABELS;

export const DASHBOARD_SORT_OPTIONS = DASHBOARD_SORTS.map((sort) => ({
  value: sort,
  label: ANALYTICS_SORT_LABELS[sort],
}));

export const DASHBOARD_MAIN_THEME_LABELS = MAIN_THEME_LABELS;
export const DASHBOARD_SUB_THEME_LABELS = SUB_THEME_LABELS;
