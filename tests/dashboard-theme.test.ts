import { describe, expect, it } from "vitest";

import {
  DASHBOARD_CATEGORIES,
  DASHBOARD_CATEGORY_LABELS,
  percentageShares,
} from "@/lib/analytics/dashboard-overview";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe("dashboard category contract", () => {
  it("keeps the four official categories in chart order", () => {
    expect(DASHBOARD_CATEGORIES).toEqual([
      "FKRTL",
      "FKTP",
      "PEMDA",
      "STAKEHOLDER",
    ]);
    expect(DASHBOARD_CATEGORY_LABELS).toEqual({
      FKRTL: "FKRTL",
      FKTP: "FKTP",
      PEMDA: "Pemda",
      STAKEHOLDER: "Stakeholder",
    });
  });
});

describe("percentageShares", () => {
  it("always adds up to exactly 100.0 with largest remainder", () => {
    expect(percentageShares([1, 1, 1], 3)).toEqual([33.4, 33.3, 33.3]);
    expect(percentageShares([2, 1], 3)).toEqual([66.7, 33.3]);
    expect(percentageShares([1, 2, 3, 4], 10)).toEqual([10, 20, 30, 40]);
    const six = percentageShares([1, 1, 1, 1, 1, 1], 6);
    expect(sum(six)).toBeCloseTo(100, 10);
    expect(six.every((value) => value >= 16.6)).toBe(true);
  });

  it("returns zeros when there is no non-EDUFAST content", () => {
    expect(percentageShares([0, 0], 0)).toEqual([0, 0]);
    expect(percentageShares([], 0)).toEqual([]);
  });

  it("breaks fractional ties by row order for deterministic output", () => {
    expect(percentageShares([1, 1, 1], 3)).toEqual([33.4, 33.3, 33.3]);
    expect(percentageShares([1, 1, 1, 1, 1, 1], 6)).toEqual([
      16.7, 16.7, 16.7, 16.7, 16.6, 16.6,
    ]);
  });
});
