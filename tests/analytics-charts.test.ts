import { describe, expect, it } from "vitest";

import { monthWindow, trailingMonthKeys } from "@/lib/analytics/period-window";
import {
  monthPeriod,
  parsePeriod,
  quarterPeriod,
  yearPeriod,
} from "@/lib/periods";

describe("trailingMonthKeys", () => {
  it("returns the trailing window ending at the selected month", () => {
    expect(trailingMonthKeys(monthPeriod(2026, 10), 6)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  it("rolls into the previous year without skipping a month", () => {
    expect(trailingMonthKeys(monthPeriod(2027, 2), 6)).toEqual([
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  it("includes every month of a quarter period", () => {
    expect(trailingMonthKeys(quarterPeriod(2026, 4), 6)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
  });

  it("never truncates a full year period", () => {
    const keys = trailingMonthKeys(yearPeriod(2026), 6);
    expect(keys).toHaveLength(12);
    expect(keys[0]).toBe("2026-01");
    expect(keys[11]).toBe("2026-12");
  });

  it("is zero-fill friendly: keys are unique and sorted", () => {
    const keys = trailingMonthKeys(parsePeriod("2026-Q1"), 12);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(keys);
    expect(keys.at(-1)).toBe("2026-03");
  });
});

describe("monthWindow", () => {
  it("spans the first through last day of the trailing window", () => {
    expect(monthWindow(["2026-09", "2026-10"])).toEqual({
      start: "2026-09-01",
      end: "2026-10-31",
    });
  });

  it("handles February in a leap year", () => {
    expect(monthWindow(["2028-02"])).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
  });
});
