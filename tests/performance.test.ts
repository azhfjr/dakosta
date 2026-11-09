import { describe, expect, it } from "vitest";

import {
  buildPerformanceQuery,
  parsePerformanceFilters,
  performancePeriodLabel,
  performanceSourceLabel,
} from "@/lib/performance";

const BRANCH_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("performance filters", () => {
  it("applies safe defaults for an empty query", () => {
    const filters = parsePerformanceFilters(new URLSearchParams());
    expect(filters.sort).toBe("approved");
    expect(filters.direction).toBe("desc");
    expect(filters.status).toBe("ALL");
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(25);
    expect(filters.branchId).toBeNull();
    expect(filters.source).toBeNull();
    expect(filters.q).toBeNull();
  });

  it("parses period, branch, source, and status and ignores numeric ranges", () => {
    const filters = parsePerformanceFilters(
      new URLSearchParams({
        period: "2026-Q4",
        branch: BRANCH_ID,
        type: "faskes_fktp",
        status: "below",
        q: "  klinik  ",
        pmin: "10,5",
        pmax: "80",
        rmin: "2",
        tmin: "5",
        sort: "percent",
        dir: "asc",
        page: "3",
        pageSize: "100",
      }),
    );
    expect(filters.period.key).toBe("2026-Q4");
    expect(filters.branchId).toBe(BRANCH_ID);
    expect(filters.source).toBe("FASKES_FKTP");
    expect(filters.status).toBe("BELOW");
    expect(filters.q).toBe("klinik");
    expect(filters.sort).toBe("percent");
    expect(filters.direction).toBe("asc");
    expect(filters.page).toBe(3);
    expect(filters.pageSize).toBe(100);
  });

  it("rejects unknown values instead of trusting the query string", () => {
    const filters = parsePerformanceFilters(
      new URLSearchParams({
        branch: "not-a-uuid",
        type: "FASKES",
        status: "UNKNOWN",
        sort: "password",
        dir: "sideways",
        page: "-2",
        pageSize: "999",
        pmin: "-1",
        rmax: "1000001",
      }),
    );
    expect(filters.branchId).toBeNull();
    expect(filters.source).toBeNull();
    expect(filters.status).toBe("ALL");
    expect(filters.sort).toBe("approved");
    expect(filters.direction).toBe("desc");
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(25);
    expect(buildPerformanceQuery(filters)).not.toMatch(
      /pmin|pmax|rmin|rmax|tmin|tmax/,
    );
  });

  it("caps the search term at 80 characters", () => {
    const filters = parsePerformanceFilters(
      new URLSearchParams({ q: "a".repeat(200) }),
    );
    expect(filters.q).toHaveLength(80);
  });

  it("round-trips through the query builder without leaking empty params", () => {
    const filters = parsePerformanceFilters(
      new URLSearchParams({
        period: "2026-10",
        branch: BRANCH_ID,
        status: "MET",
        sort: "difference",
        dir: "asc",
        pageSize: "50",
      }),
    );
    const query = buildPerformanceQuery(filters);
    const roundTrip = parsePerformanceFilters(new URLSearchParams(query));
    expect(roundTrip.period.key).toBe("2026-10");
    expect(roundTrip.branchId).toBe(BRANCH_ID);
    expect(roundTrip.status).toBe("MET");
    expect(roundTrip.sort).toBe("difference");
    expect(roundTrip.direction).toBe("asc");
    expect(roundTrip.pageSize).toBe(50);
    expect(query).not.toContain("type=");
    expect(query).not.toContain("q=");
  });

  it("applies pagination overrides for sort headers", () => {
    const filters = parsePerformanceFilters(
      new URLSearchParams({
        page: "4",
        sort: "name",
        dir: "asc",
        pageSize: "50",
      }),
    );
    const query = buildPerformanceQuery(filters, {
      sort: "target",
      dir: "desc",
      page: 1,
    });
    const parsed = new URLSearchParams(query);
    expect(parsed.get("sort")).toBe("target");
    expect(parsed.get("dir")).toBe("desc");
    expect(parsed.get("page")).toBe("1");
    expect(parsed.get("pageSize")).toBe("50");
  });

  it("labels periods and sources for print and export", () => {
    expect(
      performancePeriodLabel(parsePerformanceFilters(new URLSearchParams()))
        .length,
    ).toBeGreaterThan(0);
    expect(performanceSourceLabel(null)).toBe("Semua jenis instansi");
    expect(performanceSourceLabel("PEMDA")).not.toBe("");
  });
});
