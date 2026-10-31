import { describe, expect, it } from "vitest";

import {
  CONTENT_TYPES,
  LEGACY_THEME_TO_SUBTHEME,
  MAIN_THEMES,
  SUB_THEMES,
  isContentType,
  isMainTheme,
  isSubTheme,
  isValidPeriod,
  periodLabel,
  periodOfDate,
  shiftPeriod,
} from "@/lib/taxonomy";

describe("taxonomy", () => {
  it("has exactly six sub-themes and two main themes", () => {
    expect(SUB_THEMES).toHaveLength(6);
    expect(MAIN_THEMES).toEqual(["EDUFAST", "NON_EDUFAST"]);
    expect(CONTENT_TYPES).toEqual(["VIDEO", "INFOGRAFIS"]);
  });

  it("guards unknown enum values", () => {
    expect(isMainTheme("EDUFAST")).toBe(true);
    expect(isMainTheme("edufast")).toBe(false);
    expect(isSubTheme("MOBILE_JKN")).toBe(true);
    expect(isSubTheme("LAINNYA")).toBe(false);
    expect(isContentType("INFOGRAFIS")).toBe(true);
    expect(isContentType("AUDIO")).toBe(false);
  });

  it("derives the period from the content date, not the approval date", () => {
    expect(periodOfDate("2026-10-31")).toBe("2026-10");
    expect(periodOfDate("2026-01-01")).toBe("2026-01");
  });

  it("labels and shifts periods across year boundaries", () => {
    expect(periodLabel("2026-10")).toBe("Oktober 2026");
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2026-12", 1)).toBe("2027-01");
    expect(shiftPeriod("2026-06", -13)).toBe("2025-05");
  });

  it("validates the YYYY-MM period format", () => {
    expect(isValidPeriod("2026-10")).toBe(true);
    expect(isValidPeriod("2026-13")).toBe(false);
    expect(isValidPeriod("2026-1")).toBe(false);
    expect(isValidPeriod("202610")).toBe(false);
  });

  it("maps every legacy theme slug to a canonical sub-theme", () => {
    const values = Object.values(LEGACY_THEME_TO_SUBTHEME);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(SUB_THEMES).toContain(value);
    }
  });
});
