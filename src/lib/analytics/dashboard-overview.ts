import "server-only";

import { and, count, eq, inArray, sql, type SQL } from "drizzle-orm";

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
import { cachedRead, readCacheKey } from "@/lib/read-cache";
import type { SessionUser } from "@/lib/session";
import { SUB_THEME_LABELS, type SubTheme } from "@/lib/taxonomy";

import {
  DASHBOARD_CATEGORIES,
  DASHBOARD_MAP_POINT_LIMIT,
  DASHBOARD_RANKING_LIMIT,
  type DashboardBranchRow,
  type DashboardCategory,
  type DashboardCategoryTotals,
  type DashboardFiltered,
  type DashboardMap,
  type DashboardMapMissingRow,
  type DashboardMapPoint,
  type DashboardRankingRow,
  type DashboardSummary,
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
  latitude: number;
  longitude: number;
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

function validCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Distributes 100.0% across the rows with the largest-remainder method so the
 * displayed legend always adds up to exactly 100.0 when total > 0.
 */
export function percentageShares(
  values: readonly number[],
  total: number,
): number[] {
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((value) => (value * 1000) / total);
  const tenths = exact.map((value) => Math.floor(value));
  let remainder = 1000 - tenths.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort(
      (left, right) =>
        right.fraction - left.fraction || left.index - right.index,
    );
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    tenths[order[cursor % order.length]!.index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return tenths.map((value) => value / 10);
}

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
    if (!validCoordinate(row.latitude, row.longitude)) {
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
        branchName: row.branchName,
        latitude: row.latitude,
        longitude: row.longitude,
        total: row.total,
        categories: { ...row.categories },
      });
    }
  }

  return {
    points,
    missingLocations,
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

function emptyFiltered(selection: BranchSelection): DashboardFiltered {
  return {
    selection,
    categoryTotals: zeroCategoryTotals(),
    rankings: {
      FKRTL: [],
      FKTP: [],
      PEMDA: [],
      STAKEHOLDER: [],
    },
    edufast: 0,
    nonEdufast: 0,
    unclassifiedTheme: 0,
    nonEdufastThemes: [],
    map: {
      points: [],
      missingLocations: [],
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
  for (const row of aggregates) totalApproved += Number(row.total);

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
  if (
    selection.mode === "none" ||
    (selection.mode === "subset" && selection.ids.length === 0)
  ) {
    return emptyFiltered(selection);
  }

  const conditions = approvedConditions(user);
  if (selection.mode === "subset") {
    conditions.push(
      inArray(schema.stakeholders.branchOfficeId, [...selection.ids]),
    );
  }

  const db = getDb();
  const [institutionRows, themeRows] = await Promise.all([
    db
      .select({
        stakeholderId: schema.stakeholders.id,
        name: schema.stakeholders.name,
        branchId: schema.stakeholders.branchOfficeId,
        branchName: schema.branchOffices.name,
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
      .where(and(...conditions))
      .groupBy(
        schema.stakeholders.id,
        schema.stakeholders.name,
        schema.stakeholders.branchOfficeId,
        schema.branchOffices.name,
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
  ]);

  const institutions: InstitutionAggregate[] = institutionRows.map((row) => ({
    stakeholderId: row.stakeholderId,
    name: row.name,
    branchId: row.branchId,
    branchName: row.branchName,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
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
  const shares = percentageShares(
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

  return {
    selection,
    categoryTotals,
    rankings: buildRankings(institutions),
    edufast,
    nonEdufast,
    unclassifiedTheme,
    nonEdufastThemes,
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
