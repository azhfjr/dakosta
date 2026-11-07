import { describe, expect, it } from "vitest";

import {
  kontenExportQuery,
  parseKontenFilters,
  toAnalyticsFilters,
} from "@/lib/filters/konten";

describe("Detail Konten filters", () => {
  it("is all-status by default and sorts by newest first", () => {
    const filters = parseKontenFilters({}, "all");
    expect(filters).toMatchObject({
      mode: "all",
      status: "ALL",
      sort: "recent",
      page: 1,
      period: "ALL",
    });
    expect(toAnalyticsFilters(filters)).toMatchObject({
      scope: "all",
      status: "ALL",
      periodBasis: "created",
    });
  });

  it("keeps the approved scope when a URL asks for another status", () => {
    const filters = parseKontenFilters(
      { status: "REJECTED", sort: "status" },
      "approved",
    );
    expect(filters.status).toBe("APPROVED");
    expect(filters.sort).toBe("status");
    expect(toAnalyticsFilters(filters)).toMatchObject({
      scope: "approved",
      status: "APPROVED",
      periodBasis: "approved",
    });
  });

  it("parses the full advanced filter set", () => {
    const filters = parseKontenFilters(
      {
        status: "REVISION_REQUIRED",
        orgType: "PEMDA",
        mainTheme: "EDUFAST",
        subTheme: "MOBILE_JKN",
        type: "VIDEO",
        platform: "instagram",
        stakeholderId: "3f6f1f9a-2d7b-4b0e-9f4b-5f0f2f7f6a11",
        from: "2025-01-01",
        to: "2025-03-31",
        q: " vaksin ",
        page: "2",
      },
      "all",
    );
    expect(filters).toMatchObject({
      status: "REVISION_REQUIRED",
      orgType: "PEMDA",
      mainTheme: "EDUFAST",
      subTheme: "MOBILE_JKN",
      contentType: "VIDEO",
      platform: "INSTAGRAM",
      dateFrom: "2025-01-01",
      dateTo: "2025-03-31",
      search: "vaksin",
      page: 2,
    });
  });

  it("drops malformed values instead of widening the query", () => {
    const filters = parseKontenFilters(
      {
        status: "BOGUS",
        orgType: "ASN",
        mainTheme: "LAIN",
        from: "31-01-2025",
        to: "2025-99-99",
      },
      "all",
    );
    expect(filters.status).toBe("ALL");
    expect(filters.orgType).toBeNull();
    expect(filters.mainTheme).toBeNull();
    expect(filters.dateFrom).toBeNull();
    expect(filters.dateTo).toBeNull();
  });
});

describe("Detail Konten export parity", () => {
  it("drops pagination and sort but keeps every active filter", () => {
    const filters = parseKontenFilters(
      {
        status: "APPROVED",
        orgType: "FASKES",
        marker: "ignored",
        from: "2025-01-01",
        q: "edukasi",
        page: "3",
      },
      "all",
    );
    const query = new URLSearchParams(kontenExportQuery(filters).slice(1));
    expect(query.get("mode")).toBe("all");
    expect(query.get("status")).toBe("APPROVED");
    expect(query.get("orgType")).toBe("FASKES");
    expect(query.get("from")).toBe("2025-01-01");
    expect(query.get("q")).toBe("edukasi");
    expect(query.get("page")).toBeNull();
    expect(query.get("sort")).toBeNull();
  });

  it("never emits defaults for an unfiltered approved view", () => {
    const filters = parseKontenFilters({}, "approved");
    expect(kontenExportQuery(filters)).toBe("");
    expect(kontenExportQuery(filters, "wilayah")).toBe("?scope=wilayah");
  });
});
