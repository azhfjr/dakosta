import { describe, expect, it } from "vitest";

import {
  buildFilterHref,
  filterResetHref,
  parseFilterContentType,
  parseFilterMainTheme,
  parseFilterPage,
  parseFilterPeriod,
  parseFilterSearch,
  parseFilterSort,
  parseFilterSource,
  parseFilterStatus,
  parseFilterSubTheme,
  parseFilterUuid,
} from "@/lib/filters/query";

const SORTS = ["recent", "oldest", "title"] as const;

describe("filter query parsers", () => {
  it("reads the canonical period and the legacy month key", () => {
    expect(parseFilterPeriod({ period: "2026-11" })).toBe("2026-11");
    expect(parseFilterPeriod({ month: "2026-03" })).toBe("2026-03");
    expect(parseFilterPeriod({ period: "all" })).toBe("ALL");
    expect(parseFilterPeriod({ period: "2026-13" })).toBe("ALL");
    expect(parseFilterPeriod({})).toBe("ALL");
  });

  it("accepts only UUID organization identifiers", () => {
    expect(parseFilterUuid("2f1c9a1e-7a5b-4c6d-8e9f-0a1b2c3d4e5f")).toBe(
      "2f1c9a1e-7a5b-4c6d-8e9f-0a1b2c3d4e5f",
    );
    expect(parseFilterUuid("not-a-uuid")).toBeNull();
    expect(parseFilterUuid(undefined)).toBeNull();
  });

  it("validates taxonomy and status values", () => {
    expect(parseFilterSubTheme("MOBILE_JKN")).toBe("MOBILE_JKN");
    expect(parseFilterSubTheme("mobile_jkn")).toBeNull();
    expect(parseFilterMainTheme("EDUFAST")).toBe("EDUFAST");
    expect(parseFilterContentType("VIDEO")).toBe("VIDEO");
    expect(parseFilterContentType("AUDIO")).toBeNull();
    expect(parseFilterStatus("approved")).toBe("APPROVED");
    expect(parseFilterStatus("UNKNOWN")).toBe("ALL");
    expect(parseFilterStatus(undefined, "APPROVED")).toBe("APPROVED");
    expect(parseFilterSource("faskes_fktp")).toBe("FASKES_FKTP");
    expect(parseFilterSource("FASKES")).toBeNull();
  });

  it("clamps pagination and search", () => {
    expect(parseFilterPage(undefined)).toBe(1);
    expect(parseFilterPage("0")).toBe(1);
    expect(parseFilterPage("2.9")).toBe(2);
    expect(parseFilterPage("abc")).toBe(1);
    expect(parseFilterSearch("  judul  ")).toBe("judul");
    expect(parseFilterSearch("x".repeat(200))).toHaveLength(80);
  });

  it("falls back for unknown sort values", () => {
    expect(parseFilterSort("title", SORTS, "recent")).toBe("title");
    expect(parseFilterSort("TITLE", SORTS, "recent")).toBe("title");
    expect(parseFilterSort("bogus", SORTS, "recent")).toBe("recent");
  });
});

describe("buildFilterHref", () => {
  const params = {
    period: "2026-11",
    status: "APPROVED",
    source: "PEMDA",
    page: "3",
    q: "edukasi",
    unrelated: "drop-me",
  };

  it("keeps filters, drops page when a filter changes, and ignores foreign keys", () => {
    const href = buildFilterHref("/cabang/konten", params, {
      subTheme: "MOBILE_JKN",
    });
    expect(href).toBe(
      "/cabang/konten?period=2026-11&subTheme=MOBILE_JKN&source=PEMDA&status=APPROVED&q=edukasi",
    );
  });

  it("keeps the page for pagination and removes cleared filters", () => {
    const href = buildFilterHref(
      "/cabang/konten",
      params,
      { page: 2, status: null },
      { keepPage: true },
    );
    expect(href).toBe(
      "/cabang/konten?period=2026-11&source=PEMDA&page=2&q=edukasi",
    );
  });

  it("keeps a canonical parameter order for overrides", () => {
    const href = buildFilterHref("/admin/konten", params, {
      stakeholderId: "2f1c9a1e-7a5b-4c6d-8e9f-0a1b2c3d4e5f",
    });
    expect(href).toBe(
      "/admin/konten?period=2026-11&stakeholderId=2f1c9a1e-7a5b-4c6d-8e9f-0a1b2c3d4e5f&source=PEMDA&status=APPROVED&q=edukasi",
    );
  });

  it('treats "ALL" as an omitted filter and appends anchors', () => {
    const href = buildFilterHref(
      "/admin",
      params,
      { period: "ALL" },
      { hash: "semua-konten" },
    );
    expect(href).toBe(
      "/admin?source=PEMDA&status=APPROVED&q=edukasi#semua-konten",
    );
    expect(filterResetHref("/admin", "konten-disetujui")).toBe(
      "/admin#konten-disetujui",
    );
  });
});
