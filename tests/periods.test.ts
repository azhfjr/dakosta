import { describe, expect, it } from "vitest";

import {
  currentMonthPeriod,
  monthPeriod,
  parsePeriod,
  periodMonthKeys,
  periodOptions,
  quarterPeriod,
  yearPeriod,
} from "@/lib/periods";

describe("periods (Asia/Jakarta)", () => {
  it("builds a month with correct inclusive/exclusive instants", () => {
    const period = monthPeriod(2026, 10);
    expect(period.key).toBe("2026-10");
    expect(period.startDate).toBe("2026-10-01");
    expect(period.endDate).toBe("2026-10-31");
    expect(period.start.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(period.endExclusive.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(period.label).toBe("Oktober 2026");
  });

  it("treats the Jakarta midnight boundary as the period edge", () => {
    const period = monthPeriod(2026, 10);
    const before = new Date("2026-09-30T16:59:59.999Z");
    const at = new Date("2026-09-30T17:00:00.000Z");
    expect(before.getTime()).toBeLessThan(period.start.getTime());
    expect(at.getTime()).toBe(period.start.getTime());
  });

  it("rolls quarters and years across the calendar boundary", () => {
    const q4 = quarterPeriod(2026, 4);
    expect(q4.key).toBe("2026-Q4");
    expect(q4.startDate).toBe("2026-10-01");
    expect(q4.endDate).toBe("2026-12-31");
    expect(q4.endExclusive.toISOString()).toBe("2026-12-31T17:00:00.000Z");
    expect(q4.label).toBe("Triwulan IV 2026");
    expect(periodMonthKeys(q4)).toEqual(["2026-10", "2026-11", "2026-12"]);

    const year = yearPeriod(2026);
    expect(year.startDate).toBe("2026-01-01");
    expect(year.endDate).toBe("2026-12-31");
    expect(year.endExclusive.toISOString()).toBe("2026-12-31T17:00:00.000Z");
    expect(periodMonthKeys(year)).toHaveLength(12);
    expect(periodMonthKeys(year)[0]).toBe("2026-01");
    expect(periodMonthKeys(year)[11]).toBe("2026-12");
  });

  it("keeps 31-day, 30-day, and February month lengths", () => {
    expect(monthPeriod(2026, 2).endDate).toBe("2026-02-28");
    expect(monthPeriod(2028, 2).endDate).toBe("2028-02-29");
    expect(monthPeriod(2026, 4).endDate).toBe("2026-04-30");
    expect(monthPeriod(2026, 7).endDate).toBe("2026-07-31");
  });

  it("parses month, quarter, and year keys", () => {
    expect(parsePeriod("2026-03").key).toBe("2026-03");
    expect(parsePeriod("2026-Q2").key).toBe("2026-Q2");
    expect(parsePeriod("2027").key).toBe("2027");
    expect(parsePeriod("2026-q3").key).toBe("2026-Q3");
  });

  it("falls back to the Jakarta current month for invalid input", () => {
    const reference = new Date("2026-03-15T04:00:00.000Z");
    expect(parsePeriod("tidak-valid", reference).key).toBe("2026-03");
    expect(parsePeriod("1999-01", reference).key).toBe("2026-03");
    expect(parsePeriod(undefined, reference).key).toBe("2026-03");
  });

  it("uses WIB when the UTC clock is still on the previous day", () => {
    expect(currentMonthPeriod(new Date("2026-12-31T16:30:00.000Z")).key).toBe(
      "2026-12",
    );
    expect(currentMonthPeriod(new Date("2026-12-31T17:30:00.000Z")).key).toBe(
      "2027-01",
    );
  });

  it("lists selectable options newest first", () => {
    const options = periodOptions(new Date("2026-11-01T03:00:00.000Z"));
    expect(options.months).toHaveLength(24);
    expect(options.months[0]?.value).toBe("2026-11");
    expect(options.months[11]?.value).toBe("2025-12");
    expect(options.quarters).toHaveLength(8);
    expect(options.quarters[0]?.value).toBe("2026-Q4");
    expect(options.years[0]?.value).toBe("2026");
    expect(options.years.at(-1)?.value).toBe("2021");
  });
});
