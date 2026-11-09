import { monthKeyFor, monthRange, previousMonthKey } from "@/lib/kpi/formulas";

import {
  DASHBOARD_CONTENT_TYPE_LABELS,
  DASHBOARD_THEME_LABELS,
  DASHBOARD_TREND_MONTHS,
  type DashboardContentTypeKey,
  type DashboardContentTypeSlice,
  type DashboardMonthlyPoint,
  type DashboardMonthlySeries,
  type DashboardThemeKey,
  type DashboardThemeTrend,
  type DashboardTypeTrend,
} from "@/lib/dashboard/types";

export const DASHBOARD_CONTENT_TYPE_ORDER: readonly DashboardContentTypeKey[] =
  ["VIDEO", "INFOGRAFIS", "UNCLASSIFIED"];

export const DASHBOARD_THEME_ORDER: readonly DashboardThemeKey[] = [
  "EDUFAST",
  "NON_EDUFAST",
];

/** Oldest → newest trailing `count` calendar months in Asia/Jakarta. */
export function trailingMonthKeys(
  reference = new Date(),
  count = DASHBOARD_TREND_MONTHS,
): string[] {
  if (count <= 0) return [];
  const keys = [monthKeyFor(reference)];
  while (keys.length < count) keys.unshift(previousMonthKey(keys[0]!));
  return keys;
}

/** Compact axis label, e.g. "Nov". */
export function monthAxisLabel(key: string): string {
  const [year, month] = key.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 15)));
}

/** Full label for tooltips and screen-reader tables, e.g. "November 2026". */
export function monthLongLabel(key: string): string {
  return monthRange(key).label;
}

const shareFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** One-decimal Indonesian percentage, e.g. "12,4%". */
export function formatShareId(value: number): string {
  return `${shareFormatter.format(value)}%`;
}

export function contentTypeKey(
  value: string | null | undefined,
): DashboardContentTypeKey {
  return value === "VIDEO" || value === "INFOGRAFIS" ? value : "UNCLASSIFIED";
}

export function themeKey(value: string | null | undefined): DashboardThemeKey {
  return value === "EDUFAST" ? "EDUFAST" : "NON_EDUFAST";
}

function seriesFromTotals(
  keys: readonly string[],
  totals: ReadonlyMap<string, number>,
): DashboardMonthlySeries {
  const points: DashboardMonthlyPoint[] = keys.map((key) => ({
    key,
    label: monthAxisLabel(key),
    total: totals.get(key) ?? 0,
  }));
  return {
    points,
    total: points.reduce((sum, point) => sum + point.total, 0),
    startKey: keys[0] ?? "",
    endKey: keys[keys.length - 1] ?? "",
  };
}

export function emptyMonthlySeries(
  reference = new Date(),
): DashboardMonthlySeries {
  return seriesFromTotals(trailingMonthKeys(reference), new Map());
}

export function buildMonthlySeries(
  rows: readonly { key: string; total: number }[],
  reference = new Date(),
): DashboardMonthlySeries {
  const keys = trailingMonthKeys(reference);
  const allowed = new Set(keys);
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!allowed.has(row.key) || row.total <= 0) continue;
    totals.set(row.key, (totals.get(row.key) ?? 0) + row.total);
  }
  return seriesFromTotals(keys, totals);
}

/**
 * Distributes 100.0% across the values with the largest-remainder method so
 * displayed shares always add up to exactly 100.0 when total > 0.
 */
export function largestRemainderShares(
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

export function contentTypeSlices(
  counts: Readonly<Partial<Record<DashboardContentTypeKey, number>>>,
): DashboardContentTypeSlice[] {
  const rows = DASHBOARD_CONTENT_TYPE_ORDER.map((type) => ({
    type,
    total: counts[type] ?? 0,
  })).filter((row) => row.total > 0);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const shares = largestRemainderShares(
    rows.map((row) => row.total),
    total,
  );
  return rows.map((row, index) => ({
    type: row.type,
    label: DASHBOARD_CONTENT_TYPE_LABELS[row.type],
    total: row.total,
    share: shares[index] ?? 0,
  }));
}

export function buildTypeMonthly(
  rows: readonly {
    key: string;
    type: DashboardContentTypeKey;
    total: number;
  }[],
  reference = new Date(),
): DashboardTypeTrend[] {
  const keys = trailingMonthKeys(reference);
  const allowed = new Set(keys);
  const totals = new Map<DashboardContentTypeKey, Map<string, number>>();
  for (const row of rows) {
    if (!allowed.has(row.key) || row.total <= 0) continue;
    const months = totals.get(row.type) ?? new Map<string, number>();
    months.set(row.key, (months.get(row.key) ?? 0) + row.total);
    totals.set(row.type, months);
  }
  return DASHBOARD_CONTENT_TYPE_ORDER.filter((type) => totals.has(type)).map(
    (type) => {
      const series = seriesFromTotals(keys, totals.get(type)!);
      return {
        type,
        label: DASHBOARD_CONTENT_TYPE_LABELS[type],
        points: series.points,
        total: series.total,
      };
    },
  );
}

export function buildThemeMonthly(
  rows: readonly {
    key: string;
    theme: DashboardThemeKey;
    total: number;
  }[],
  reference = new Date(),
): DashboardThemeTrend[] {
  const keys = trailingMonthKeys(reference);
  const allowed = new Set(keys);
  const totals = new Map<DashboardThemeKey, Map<string, number>>();
  for (const row of rows) {
    if (!allowed.has(row.key) || row.total <= 0) continue;
    const months = totals.get(row.theme) ?? new Map<string, number>();
    months.set(row.key, (months.get(row.key) ?? 0) + row.total);
    totals.set(row.theme, months);
  }
  return DASHBOARD_THEME_ORDER.map((key) => {
    const series = seriesFromTotals(keys, totals.get(key) ?? new Map());
    return {
      key,
      label: DASHBOARD_THEME_LABELS[key],
      points: series.points,
      total: series.total,
    };
  });
}
