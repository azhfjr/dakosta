import "server-only";

import { and, count, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { approvedContentCondition } from "@/lib/analytics/approved";
import {
  branchScopePredicate,
  contentScopePredicate,
} from "@/lib/authz/predicates";
import {
  branchSelectionKey,
  type BranchSelection,
} from "@/lib/filters/branch-selection";
import { monthRange } from "@/lib/kpi/formulas";
import { cachedRead, readCacheKey } from "@/lib/read-cache";
import type { SessionUser } from "@/lib/session";
import { SUB_THEME_LABELS, type SubTheme } from "@/lib/taxonomy";

import { buildInstitutionChart } from "@/lib/dashboard/institutions";
import { weightedCentroid } from "@/lib/dashboard/map-tiers";
import {
  buildMonthlySeries,
  buildThemeMonthly,
  buildTypeMonthly,
  contentTypeKey,
  contentTypeSlices,
  emptyMonthlySeries,
  largestRemainderShares,
  themeKey,
  trailingMonthKeys,
} from "@/lib/dashboard/series";
import {
  DASHBOARD_CATEGORIES,
  DASHBOARD_MAP_POINT_LIMIT,
  DASHBOARD_RANKING_LIMIT,
  type DashboardBranchRow,
  type DashboardCategory,
  type DashboardCategoryTotals,
  type DashboardContentTypeKey,
  type DashboardFiltered,
  type DashboardMap,
  type DashboardMapAggregate,
  type DashboardMapMissingRow,
  type DashboardMapPoint,
  type DashboardRankingRow,
  type DashboardSummary,
  type DashboardThemeKey,
  type DashboardThemeRow,
} from "@/lib/dashboard/types";

export {
  DASHBOARD_CATEGORIES,
  DASHBOARD_CATEGORY_LABELS,
  DASHBOARD_MAP_POINT_LIMIT,
  DASHBOARD_RANKING_LIMIT,
} from "@/lib/dashboard/types";
export type {
  DashboardBranchRow,
  DashboardCategory,
  DashboardCategoryTotals,
  DashboardFiltered,
  DashboardMap,
  DashboardMapMissingRow,
  DashboardMapPoint,
  DashboardRankingRow,
  DashboardSummary,
  DashboardThemeRow,
} from "@/lib/dashboard/types";

type InstitutionAggregate = {
  stakeholderId: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
  regionId: string | null;
  regionName: string | null;
  latitude: number | null;
  longitude: number | null;
  total: number;
  categories: DashboardCategoryTotals;
};

function zeroCategoryTotals(): DashboardCategoryTotals {
  return { FKRTL: 0, FKTP: 0, PEMDA: 0, STAKEHOLDER: 0 };
}

/**
 * Single source of truth for the four dashboard categories. Kept in SQL so the
 * aggregate never depends on a client-supplied label.
 */
function categoryExpression(): SQL<DashboardCategory> {
  return sql<DashboardCategory>`case
    when ${schema.stakeholders.organizationType} = 'FASKES'
      and ${schema.stakeholders.faskesClass} = 'FKRTL' then 'FKRTL'
    when ${schema.stakeholders.organizationType} = 'FASKES' then 'FKTP'
    when ${schema.stakeholders.organizationType} = 'PEMDA' then 'PEMDA'
    else 'STAKEHOLDER'
  end`;
}

function categoryCount(category: DashboardCategory): SQL<number> {
  return sql<number>`count(*) filter (where ${categoryExpression()} = ${category})`.mapWith(
    Number,
  );
}

function approvedConditions(user: SessionUser): SQL[] {
  const conditions: SQL[] = [approvedContentCondition()];
  const scope = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  if (scope) conditions.push(scope);
  return conditions;
}

function compareText(a: string, b: string): number {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  return lowerA < lowerB
    ? -1
    : lowerA > lowerB
      ? 1
      : a < b
        ? -1
        : a > b
          ? 1
          : 0;
}

function sortInstitutions(
  left: InstitutionAggregate,
  right: InstitutionAggregate,
): number {
  return (
    right.total - left.total ||
    compareText(left.name, right.name) ||
    left.stakeholderId.localeCompare(right.stakeholderId)
  );
}

function sortBranches(
  left: DashboardBranchRow,
  right: DashboardBranchRow,
): number {
  return (
    right.total - left.total ||
    compareText(left.name, right.name) ||
    left.id.localeCompare(right.id)
  );
}

function hasCoordinate<
  T extends { latitude: number | null; longitude: number | null },
>(row: T): row is T & { latitude: number; longitude: number } {
  const { latitude, longitude } = row;
  return (
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/** Kept as an alias so existing imports/tests keep one rounding source. */
export { largestRemainderShares as percentageShares };

function themeLabel(subTheme: string | null): string {
  if (!subTheme) return "Tanpa sub-tema";
  return SUB_THEME_LABELS[subTheme as SubTheme] ?? subTheme;
}

function buildRankings(
  institutions: InstitutionAggregate[],
): Record<DashboardCategory, DashboardRankingRow[]> {
  const rankings = {} as Record<DashboardCategory, DashboardRankingRow[]>;
  for (const category of DASHBOARD_CATEGORIES) {
    rankings[category] = institutions
      .filter((row) => row.categories[category] > 0)
      .sort(
        (left, right) =>
          right.categories[category] - left.categories[category] ||
          compareText(left.name, right.name) ||
          left.stakeholderId.localeCompare(right.stakeholderId) ||
          (left.branchId ?? "").localeCompare(right.branchId ?? ""),
      )
      .slice(0, DASHBOARD_RANKING_LIMIT)
      .map((row) => ({
        stakeholderId: row.stakeholderId,
        name: row.name,
        branchId: row.branchId,
        branchName: row.branchName,
        total: row.categories[category],
      }));
  }
  return rankings;
}

function buildMap(institutions: InstitutionAggregate[]): DashboardMap {
  const sorted = [...institutions].sort(sortInstitutions);
  const points: DashboardMapPoint[] = [];
  const missingLocations: DashboardMapMissingRow[] = [];
  let approved = 0;
  let mappedApproved = 0;
  let missingApproved = 0;
  let mappedInstitutions = 0;

  for (const row of sorted) {
    approved += row.total;
    if (!hasCoordinate(row)) {
      missingApproved += row.total;
      missingLocations.push({
        id: row.stakeholderId,
        name: row.name,
        branchName: row.branchName,
        total: row.total,
      });
      continue;
    }
    mappedInstitutions += 1;
    mappedApproved += row.total;
    if (points.length < DASHBOARD_MAP_POINT_LIMIT) {
      points.push({
        id: row.stakeholderId,
        name: row.name,
        branchId: row.branchId,
        branchName: row.branchName,
        regionId: row.regionId,
        regionName: row.regionName,
        latitude: row.latitude,
        longitude: row.longitude,
        total: row.total,
        categories: { ...row.categories },
      });
    }
  }

  const branches = aggregateMapRows(institutions, (row) =>
    row.branchId
      ? {
          id: row.branchId,
          name: row.branchName ?? row.branchId,
          parentId: row.regionId,
        }
      : null,
  );
  const regions = aggregateMapRows(institutions, (row) =>
    row.regionId
      ? {
          id: row.regionId,
          name: row.regionName ?? row.regionId,
          parentId: null,
        }
      : null,
  );
  const maxTotal = Math.max(
    0,
    ...points.map((point) => point.total),
    ...branches.map((branch) => branch.total),
    ...regions.map((region) => region.total),
  );

  return {
    points,
    branches,
    regions,
    missingLocations,
    maxTotal,
    totals: {
      approved,
      mappedApproved,
      missingApproved,
      institutions: institutions.length,
      mappedInstitutions,
      missingInstitutions: institutions.length - mappedInstitutions,
      truncated: mappedInstitutions > points.length,
    },
  };
}

type MapGroupRow = {
  id: string;
  name: string;
  parentId: string | null;
  total: number;
  categories: DashboardCategoryTotals;
  institutionCount: number;
  missingInstitutions: number;
  located: { latitude: number; longitude: number; total: number }[];
};

/**
 * Rolls institutions up to a parent tier. Totals include institutions without
 * coordinates; the centroid only uses located ones so a missing pin never
 * drags the bubble into the ocean.
 */
function aggregateMapRows(
  institutions: readonly InstitutionAggregate[],
  group: (
    row: InstitutionAggregate,
  ) => { id: string; name: string; parentId: string | null } | null,
): DashboardMapAggregate[] {
  const groups = new Map<string, MapGroupRow>();
  for (const row of institutions) {
    const key = group(row);
    if (!key) continue;
    let entry = groups.get(key.id);
    if (!entry) {
      entry = {
        ...key,
        total: 0,
        categories: zeroCategoryTotals(),
        institutionCount: 0,
        missingInstitutions: 0,
        located: [],
      };
      groups.set(key.id, entry);
    }
    entry.total += row.total;
    entry.institutionCount += 1;
    for (const category of DASHBOARD_CATEGORIES) {
      entry.categories[category] += row.categories[category];
    }
    if (hasCoordinate(row)) {
      entry.located.push({
        latitude: row.latitude,
        longitude: row.longitude,
        total: row.total,
      });
    } else {
      entry.missingInstitutions += 1;
    }
  }

  return [...groups.values()]
    .map((entry) => {
      const centroid = weightedCentroid(entry.located);
      return {
        id: entry.id,
        name: entry.name,
        parentId: entry.parentId,
        latitude: centroid?.latitude ?? null,
        longitude: centroid?.longitude ?? null,
        total: entry.total,
        categories: { ...entry.categories },
        institutionCount: entry.institutionCount,
        missingInstitutions: entry.missingInstitutions,
      };
    })
    .sort(
      (left, right) =>
        right.total - left.total ||
        compareText(left.name, right.name) ||
        left.id.localeCompare(right.id),
    );
}

function emptyFiltered(
  selection: BranchSelection,
  reference = new Date(),
): DashboardFiltered {
  return {
    selection,
    categoryTotals: zeroCategoryTotals(),
    rankings: {
      FKRTL: [],
      FKTP: [],
      PEMDA: [],
      STAKEHOLDER: [],
    },
    institutionChart: buildInstitutionChart([]),
    edufast: 0,
    nonEdufast: 0,
    unclassifiedTheme: 0,
    nonEdufastThemes: [],
    monthly: emptyMonthlySeries(reference),
    contentTypes: [],
    typeMonthly: [],
    themeMonthly: [],
    map: {
      points: [],
      branches: [],
      regions: [],
      missingLocations: [],
      maxTotal: 0,
      totals: {
        approved: 0,
        mappedApproved: 0,
        missingApproved: 0,
        institutions: 0,
        mappedInstitutions: 0,
        missingInstitutions: 0,
        truncated: false,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

async function loadSummary(user: SessionUser): Promise<DashboardSummary> {
  const db = getDb();
  const branchScope = branchScopePredicate(user.scope, schema.branchOffices.id);
  const universeConditions: SQL[] = [];
  if (branchScope) universeConditions.push(branchScope);

  const [universe, aggregates] = await Promise.all([
    db
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
      .where(universeConditions.length ? and(...universeConditions) : undefined)
      .orderBy(schema.regionalOffices.name, schema.branchOffices.name),
    db
      .select({
        branchId: schema.stakeholders.branchOfficeId,
        total: count().mapWith(Number),
        fkrtl: categoryCount("FKRTL"),
        fktp: categoryCount("FKTP"),
        pemda: categoryCount("PEMDA"),
        stakeholder: categoryCount("STAKEHOLDER"),
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(and(...approvedConditions(user)))
      .groupBy(schema.stakeholders.branchOfficeId),
  ]);

  const aggregateByBranch = new Map(
    aggregates.map((row) => [row.branchId, row]),
  );
  let totalApproved = 0;
  const categoryTotals = zeroCategoryTotals();
  for (const row of aggregates) {
    totalApproved += Number(row.total);
    categoryTotals.FKRTL += Number(row.fkrtl);
    categoryTotals.FKTP += Number(row.fktp);
    categoryTotals.PEMDA += Number(row.pemda);
    categoryTotals.STAKEHOLDER += Number(row.stakeholder);
  }

  const categoryShares = {} as Record<DashboardCategory, number>;
  const categorized = DASHBOARD_CATEGORIES.reduce(
    (sum, category) => sum + categoryTotals[category],
    0,
  );
  const shares = largestRemainderShares(
    DASHBOARD_CATEGORIES.map((category) => categoryTotals[category]),
    categorized,
  );
  DASHBOARD_CATEGORIES.forEach((category, index) => {
    categoryShares[category] = shares[index] ?? 0;
  });

  let matchedTotal = 0;
  const branches: DashboardBranchRow[] = universe.map((branch) => {
    const aggregate = aggregateByBranch.get(branch.id);
    const total = Number(aggregate?.total ?? 0);
    matchedTotal += total;
    return {
      id: branch.id,
      name: branch.name,
      regionName: branch.regionName,
      categories: {
        FKRTL: Number(aggregate?.fkrtl ?? 0),
        FKTP: Number(aggregate?.fktp ?? 0),
        PEMDA: Number(aggregate?.pemda ?? 0),
        STAKEHOLDER: Number(aggregate?.stakeholder ?? 0),
      },
      total,
    };
  });
  branches.sort(sortBranches);

  return {
    totalApproved,
    categoryTotals,
    categoryShares,
    branches,
    branchCount: branches.length,
    branchesWithContent: branches.filter((branch) => branch.total > 0).length,
    unassignedApproved: totalApproved - matchedTotal,
    selectionApplicable: branches.length > 0,
  };
}

async function loadFiltered(
  user: SessionUser,
  selection: BranchSelection,
): Promise<DashboardFiltered> {
  const reference = new Date();
  if (
    selection.mode === "none" ||
    (selection.mode === "subset" && selection.ids.length === 0)
  ) {
    return emptyFiltered(selection, reference);
  }

  const conditions = approvedConditions(user);
  if (selection.mode === "subset") {
    conditions.push(
      inArray(schema.stakeholders.branchOfficeId, [...selection.ids]),
    );
  }

  const monthKeys = trailingMonthKeys(reference);
  const windowStart = monthRange(monthKeys[0]!).startInstant;
  const windowEnd = monthRange(monthKeys[monthKeys.length - 1]!).endInstant;
  const monthKeyExpression = sql<string>`to_char(${schema.contentSubmissions.approvedAt} at time zone 'Asia/Jakarta', 'YYYY-MM')`;

  const db = getDb();
  const [institutionRows, themeRows, typeRows, monthRows] = await Promise.all([
    db
      .select({
        stakeholderId: schema.stakeholders.id,
        name: schema.stakeholders.name,
        branchId: schema.stakeholders.branchOfficeId,
        branchName: schema.branchOffices.name,
        regionId: schema.branchOffices.regionalOfficeId,
        regionName: schema.regionalOffices.name,
        latitude: schema.stakeholders.latitude,
        longitude: schema.stakeholders.longitude,
        total: count().mapWith(Number),
        fkrtl: categoryCount("FKRTL"),
        fktp: categoryCount("FKTP"),
        pemda: categoryCount("PEMDA"),
        stakeholder: categoryCount("STAKEHOLDER"),
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
        schema.regionalOffices,
        eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
      )
      .where(and(...conditions))
      .groupBy(
        schema.stakeholders.id,
        schema.stakeholders.name,
        schema.stakeholders.branchOfficeId,
        schema.branchOffices.name,
        schema.branchOffices.regionalOfficeId,
        schema.regionalOffices.name,
        schema.stakeholders.latitude,
        schema.stakeholders.longitude,
      ),
    db
      .select({
        mainTheme: schema.contentSubmissions.mainTheme,
        subTheme: schema.contentSubmissions.subTheme,
        total: count().mapWith(Number),
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(and(...conditions))
      .groupBy(
        schema.contentSubmissions.mainTheme,
        schema.contentSubmissions.subTheme,
      ),
    db
      .select({
        contentType: schema.contentSubmissions.contentType,
        total: count().mapWith(Number),
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(and(...conditions))
      .groupBy(schema.contentSubmissions.contentType),
    db
      .select({
        monthKey: monthKeyExpression,
        contentType: schema.contentSubmissions.contentType,
        mainTheme: schema.contentSubmissions.mainTheme,
        total: count().mapWith(Number),
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(
        and(
          ...conditions,
          gte(schema.contentSubmissions.approvedAt, windowStart),
          lt(schema.contentSubmissions.approvedAt, windowEnd),
        ),
      )
      .groupBy(
        monthKeyExpression,
        schema.contentSubmissions.contentType,
        schema.contentSubmissions.mainTheme,
      ),
  ]);

  const institutions: InstitutionAggregate[] = institutionRows.map((row) => ({
    stakeholderId: row.stakeholderId,
    name: row.name,
    branchId: row.branchId,
    branchName: row.branchName,
    regionId: row.regionId,
    regionName: row.regionName,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    total: Number(row.total),
    categories: {
      FKRTL: Number(row.fkrtl),
      FKTP: Number(row.fktp),
      PEMDA: Number(row.pemda),
      STAKEHOLDER: Number(row.stakeholder),
    },
  }));

  const categoryTotals = zeroCategoryTotals();
  for (const row of institutions) {
    for (const category of DASHBOARD_CATEGORIES) {
      categoryTotals[category] += row.categories[category];
    }
  }

  let edufast = 0;
  let nonEdufast = 0;
  let unclassifiedTheme = 0;
  const subThemeTotals = new Map<string, number>();
  for (const row of themeRows) {
    const total = Number(row.total);
    if (row.mainTheme === "EDUFAST") {
      edufast += total;
      continue;
    }
    nonEdufast += total;
    if (row.mainTheme === null) unclassifiedTheme += total;
    const key = row.subTheme ?? "TANPA_SUB_TEMA";
    subThemeTotals.set(key, (subThemeTotals.get(key) ?? 0) + total);
  }

  const themeEntries = [...subThemeTotals.entries()]
    .filter(([, total]) => total > 0)
    .sort(
      ([leftKey, leftTotal], [rightKey, rightTotal]) =>
        rightTotal - leftTotal ||
        compareText(
          themeLabel(leftKey === "TANPA_SUB_TEMA" ? null : leftKey),
          themeLabel(rightKey === "TANPA_SUB_TEMA" ? null : rightKey),
        ) ||
        leftKey.localeCompare(rightKey),
    );
  const shares = largestRemainderShares(
    themeEntries.map(([, total]) => total),
    nonEdufast,
  );
  const nonEdufastThemes: DashboardThemeRow[] = themeEntries.map(
    ([key, total], index) => ({
      key,
      label: themeLabel(key === "TANPA_SUB_TEMA" ? null : key),
      total,
      percentage: shares[index] ?? 0,
    }),
  );

  const monthTotals = new Map<string, number>();
  const allTimeTypeCounts: Partial<Record<DashboardContentTypeKey, number>> =
    {};
  for (const row of typeRows) {
    const type = contentTypeKey(row.contentType);
    allTimeTypeCounts[type] =
      (allTimeTypeCounts[type] ?? 0) + Number(row.total);
  }
  const typeMonthTotals = new Map<
    string,
    { key: string; type: DashboardContentTypeKey; total: number }
  >();
  const themeMonthTotals = new Map<
    string,
    { key: string; theme: DashboardThemeKey; total: number }
  >();
  for (const row of monthRows) {
    const total = Number(row.total);
    if (total <= 0) continue;
    const key = row.monthKey;
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + total);

    const type = contentTypeKey(row.contentType);
    const typeEntry = typeMonthTotals.get(`${key}:${type}`);
    if (typeEntry) typeEntry.total += total;
    else typeMonthTotals.set(`${key}:${type}`, { key, type, total });

    const theme = themeKey(row.mainTheme);
    const themeEntry = themeMonthTotals.get(`${key}:${theme}`);
    if (themeEntry) themeEntry.total += total;
    else themeMonthTotals.set(`${key}:${theme}`, { key, theme, total });
  }

  return {
    selection,
    categoryTotals,
    rankings: buildRankings(institutions),
    institutionChart: buildInstitutionChart(institutions),
    edufast,
    nonEdufast,
    unclassifiedTheme,
    nonEdufastThemes,
    monthly: buildMonthlySeries(
      [...monthTotals].map(([key, total]) => ({ key, total })),
      reference,
    ),
    contentTypes: contentTypeSlices(allTimeTypeCounts),
    typeMonthly: buildTypeMonthly([...typeMonthTotals.values()], reference),
    themeMonthly: buildThemeMonthly([...themeMonthTotals.values()], reference),
    map: buildMap(institutions),
    generatedAt: new Date().toISOString(),
  };
}

/** A1/A2 snapshot: independent of the branch checklist by design. */
export async function getDashboardSummary(
  user: SessionUser,
): Promise<DashboardSummary> {
  return cachedRead(readCacheKey(user, ["dashboard-v3-summary"]), () =>
    loadSummary(user),
  );
}

/** B/C snapshot: one selection drives rankings, map, and theme panels. */
export async function getDashboardFiltered(
  user: SessionUser,
  selection: BranchSelection,
): Promise<DashboardFiltered> {
  return cachedRead(
    readCacheKey(user, [
      "dashboard-v3-filtered",
      branchSelectionKey(selection),
    ]),
    () => loadFiltered(user, selection),
  );
}

/** Export/PDF path: a downloaded file must be a live snapshot, not cached. */
export async function getDashboardSummaryUncached(
  user: SessionUser,
): Promise<DashboardSummary> {
  return loadSummary(user);
}

export async function getDashboardFilteredUncached(
  user: SessionUser,
  selection: BranchSelection,
): Promise<DashboardFiltered> {
  return loadFiltered(user, selection);
}
