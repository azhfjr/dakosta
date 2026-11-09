import { describe, expect, it } from "vitest";

import {
  buildInstitutionChart,
  DASHBOARD_INSTITUTION_CHART_LIMIT,
} from "@/lib/dashboard/institutions";
import type { DashboardCategoryTotals } from "@/lib/dashboard/types";

type InputRow = {
  stakeholderId: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
  total: number;
  categories: DashboardCategoryTotals;
};

function categories(total: number): DashboardCategoryTotals {
  return {
    FKRTL: total,
    FKTP: 0,
    PEMDA: 0,
    STAKEHOLDER: 0,
  };
}

function row(
  index: number,
  total: number,
  name = `Institusi ${String(index).padStart(3, "0")}`,
): InputRow {
  return {
    stakeholderId: `stakeholder-${index}`,
    name,
    branchId: "branch-1",
    branchName: "Cabang Satu",
    total,
    categories: categories(total),
  };
}

describe("buildInstitutionChart", () => {
  it("returns an empty chart for an empty universe", () => {
    expect(buildInstitutionChart([])).toEqual({
      total: 0,
      rows: [],
      remaining: null,
    });
  });

  it("keeps every institution when the list fits the chart budget", () => {
    const input = [row(1, 7), row(2, 12), row(3, 9)];
    const chart = buildInstitutionChart(input);

    expect(chart.total).toBe(28);
    expect(chart.remaining).toBeNull();
    expect(chart.rows.map((entry) => entry.total)).toEqual([12, 9, 7]);
    expect(chart.rows[0]).toEqual({
      id: "stakeholder-2",
      name: "Institusi 002",
      branchName: "Cabang Satu",
      total: 12,
      categories: categories(12),
    });
  });

  it("keeps the top twelve and reconciles the aggregate remainder", () => {
    const input = Array.from({ length: 20 }, (_, index) =>
      row(index + 1, 100 - index),
    );
    const chart = buildInstitutionChart(input);

    expect(DASHBOARD_INSTITUTION_CHART_LIMIT).toBe(12);
    expect(chart.rows).toHaveLength(12);
    expect(chart.rows[0].total).toBe(100);
    expect(chart.rows.at(-1)?.total).toBe(89);
    expect(chart.remaining).not.toBeNull();
    expect(chart.remaining?.count).toBe(8);
    expect(chart.remaining?.total).toBe(
      input.slice(12).reduce((sum, entry) => sum + entry.total, 0),
    );
    expect(chart.remaining?.categories).toEqual({
      FKRTL: chart.remaining?.total,
      FKTP: 0,
      PEMDA: 0,
      STAKEHOLDER: 0,
    });

    const visibleTotal = chart.rows.reduce(
      (sum, entry) => sum + entry.total,
      0,
    );
    expect(visibleTotal + (chart.remaining?.total ?? 0)).toBe(chart.total);
    expect(chart.total).toBe(
      input.reduce((sum, entry) => sum + entry.total, 0),
    );
  });

  it("breaks ties by name and ignores empty institutions", () => {
    const chart = buildInstitutionChart([
      row(1, 5, "Beta"),
      row(2, 5, "alpha"),
      row(3, 0, "Nol"),
    ]);

    expect(chart.rows.map((entry) => entry.name)).toEqual(["alpha", "Beta"]);
    expect(chart.total).toBe(10);
  });

  it("does not mutate the caller's rows", () => {
    const input = [row(1, 3), row(2, 9)];
    const snapshot = structuredClone(input);
    buildInstitutionChart(input);
    expect(input).toEqual(snapshot);
  });
});
