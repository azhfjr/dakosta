import {
  DASHBOARD_CATEGORIES,
  type DashboardCategoryTotals,
  type DashboardInstitutionChart,
  type DashboardInstitutionRow,
} from "@/lib/dashboard/types";

export const DASHBOARD_INSTITUTION_CHART_LIMIT = 12;

type InstitutionChartSource = {
  stakeholderId: string;
  name: string;
  branchName: string | null;
  total: number;
  categories: DashboardCategoryTotals;
};

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

function zeroCategories(): DashboardCategoryTotals {
  return { FKRTL: 0, FKTP: 0, PEMDA: 0, STAKEHOLDER: 0 };
}

/**
 * Derives the institution bar chart from rows already loaded for rankings and
 * the map: top N by approved content, with the remainder collapsed into one
 * aggregate row so the chart never exceeds the panel budget.
 */
export function buildInstitutionChart(
  rows: readonly InstitutionChartSource[],
  limit = DASHBOARD_INSTITUTION_CHART_LIMIT,
): DashboardInstitutionChart {
  const positive = rows.filter((row) => row.total > 0);
  const sorted = [...positive].sort(
    (left, right) =>
      right.total - left.total ||
      compareText(left.name, right.name) ||
      left.stakeholderId.localeCompare(right.stakeholderId),
  );

  const chartRows: DashboardInstitutionRow[] = sorted
    .slice(0, limit)
    .map((row) => ({
      id: row.stakeholderId,
      name: row.name,
      branchName: row.branchName,
      total: row.total,
      categories: { ...row.categories },
    }));

  const hidden = sorted.slice(limit);
  let remaining: DashboardInstitutionChart["remaining"] = null;
  if (hidden.length > 0) {
    const categories = zeroCategories();
    let total = 0;
    for (const row of hidden) {
      total += row.total;
      for (const category of DASHBOARD_CATEGORIES) {
        categories[category] += row.categories[category];
      }
    }
    remaining = { count: hidden.length, total, categories };
  }

  return {
    total: sorted.reduce((sum, row) => sum + row.total, 0),
    rows: chartRows,
    remaining,
  };
}
