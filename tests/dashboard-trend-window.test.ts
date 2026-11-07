import { describe, expect, it } from "vitest";

import {
  DASHBOARD_TREND_MONTHS,
  dashboardTrendWindow,
} from "@/lib/analytics/dashboard";
import { monthKeyFor, monthRange, previousMonthKey } from "@/lib/kpi/formulas";

describe("dashboard trend window", () => {
  it("spans the configured number of months, oldest first", () => {
    const window = dashboardTrendWindow();
    expect(window.keys).toHaveLength(DASHBOARD_TREND_MONTHS);

    const expectedKeys: string[] = [monthKeyFor()];
    for (let index = 1; index < DASHBOARD_TREND_MONTHS; index += 1) {
      expectedKeys.push(
        previousMonthKey(expectedKeys[expectedKeys.length - 1]!),
      );
    }
    expectedKeys.reverse();

    expect(window.keys).toEqual(expectedKeys);
  });

  it("starts at the earliest bucket, not the current month", () => {
    const window = dashboardTrendWindow(24);
    const earliest = window.keys[0]!;
    const current = window.keys[window.keys.length - 1]!;

    expect(window.keys).toHaveLength(24);
    expect(window.start.getTime()).toBe(
      monthRange(earliest).startInstant.getTime(),
    );
    expect(window.end.getTime()).toBe(monthRange(current).endInstant.getTime());
    expect(window.start.getTime()).toBeLessThan(window.end.getTime());
    expect(current).toBe(monthKeyFor());
  });

  it("honours an explicit bucket count", () => {
    const window = dashboardTrendWindow(6);
    expect(window.keys).toHaveLength(6);
    expect(window.keys[5]).toBe(monthKeyFor());
    expect(window.keys[0]).toBe(previousMonthKey(window.keys[1]!));
    expect(window.start.getTime()).toBe(
      monthRange(window.keys[0]!).startInstant.getTime(),
    );
  });
});
