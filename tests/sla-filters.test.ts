import { describe, expect, it } from "vitest";

import { parseSlaFilters, slaQuery } from "@/lib/analytics/sla";
import { monthKeyFor } from "@/lib/kpi/formulas";

const UUID = "3f6f1f9a-2d7b-4b0e-9f4b-5f0f2f7f6a11";

describe("SLA filters", () => {
  it("defaults to the current period with no narrowing filters", () => {
    expect(parseSlaFilters({})).toEqual({
      period: monthKeyFor(),
      orgType: null,
      mainTheme: null,
      subTheme: null,
      search: "",
      page: 1,
    });
  });

  it("accepts exactly one organization type", () => {
    expect(parseSlaFilters({ orgType: "PEMDA" }).orgType).toBe("PEMDA");
    expect(parseSlaFilters({ orgType: "pemda" }).orgType).toBe("PEMDA");
    expect(parseSlaFilters({ orgType: "SEMUA" }).orgType).toBeNull();
    expect(parseSlaFilters({ orgType: "" }).orgType).toBeNull();
  });

  it("ignores the legacy stakeholder parameter so scope cannot be widened", () => {
    const filters = parseSlaFilters({ stakeholderId: UUID, orgType: "FASKES" });
    expect(filters).not.toHaveProperty("stakeholderId");
    expect(filters.orgType).toBe("FASKES");
  });

  it("keeps a valid period and falls back on an invalid one", () => {
    expect(parseSlaFilters({ period: "2025-03" }).period).toBe("2025-03");
    expect(parseSlaFilters({ period: "2025-13" }).period).toBe(monthKeyFor());
    expect(parseSlaFilters({ period: "lalu" }).period).toBe(monthKeyFor());
  });

  it("parses theme, sub-theme, search and page", () => {
    const filters = parseSlaFilters({
      mainTheme: "EDUFAST",
      subTheme: "MOBILE_JKN",
      q: "  vaksin  ",
      page: "4",
    });
    expect(filters.mainTheme).toBe("EDUFAST");
    expect(filters.subTheme).toBe("MOBILE_JKN");
    expect(filters.search).toBe("vaksin");
    expect(filters.page).toBe(4);
    expect(parseSlaFilters({ page: "0" }).page).toBe(1);
  });
});

describe("SLA query round-trip", () => {
  it("omits defaults and keeps active filters", () => {
    expect(slaQuery(parseSlaFilters({}))).toEqual({ period: monthKeyFor() });
    expect(
      slaQuery(
        parseSlaFilters({
          period: "2025-02",
          orgType: "OTHER",
          mainTheme: "NON_EDUFAST",
          subTheme: "KORPORAT",
          q: "edukasi",
          page: "2",
        }),
      ),
    ).toEqual({
      period: "2025-02",
      orgType: "OTHER",
      mainTheme: "NON_EDUFAST",
      subTheme: "KORPORAT",
      q: "edukasi",
      page: "2",
    });
  });
});
