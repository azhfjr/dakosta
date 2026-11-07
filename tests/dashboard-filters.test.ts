import { describe, expect, it } from "vitest";

import {
  approvedDashboardQuery,
  parseApprovedDashboardFilters,
} from "@/lib/analytics/dashboard";
import { dashboardViewAnchor } from "@/lib/dashboard/view";

const UUID = "3f6f1f9a-2d7b-4b0e-9f4b-5f0f2f7f6a11";

describe("approved dashboard filters", () => {
  it("always scopes to approved content and ignores operational params", () => {
    const filters = parseApprovedDashboardFilters({
      status: "REJECTED",
      period: "2025-01",
      scope: "all",
    });
    expect(filters.table.status).toBe("ALL");
    expect(filters.table.scope).toBe("approved");
    expect(filters.table.period).toBe("ALL");
    expect(filters.table.periodBasis).toBe("approved");
  });

  it("parses the table filter set", () => {
    const filters = parseApprovedDashboardFilters({
      q: "  vaksin ",
      stakeholderId: UUID,
      orgType: "PEMDA",
      mainTheme: "EDUFAST",
      subTheme: "MOBILE_JKN",
      type: "VIDEO",
      platform: "INSTAGRAM",
      from: "2025-01-01",
      to: "2025-03-31",
      sort: "approved_oldest",
      page: "3",
    });
    expect(filters.table).toMatchObject({
      search: "vaksin",
      stakeholderId: UUID,
      orgType: "PEMDA",
      mainTheme: "EDUFAST",
      subTheme: "MOBILE_JKN",
      contentType: "VIDEO",
      platform: "INSTAGRAM",
      dateFrom: "2025-01-01",
      dateTo: "2025-03-31",
      sort: "approved_oldest",
      page: 3,
    });
  });

  it("drops invalid dates, uuid, theme and cascade mismatches", () => {
    const filters = parseApprovedDashboardFilters({
      stakeholderId: "not-a-uuid",
      from: "31-01-2025",
      mainTheme: "UNKNOWN",
      subTheme: "MOBILE_JKN",
      sort: "status",
    });
    expect(filters.table.stakeholderId).toBeNull();
    expect(filters.table.dateFrom).toBeNull();
    expect(filters.table.mainTheme).toBeNull();
    expect(filters.table.subTheme).toBe("MOBILE_JKN");
    expect(filters.table.sort).toBe("status");
  });

  it("clamps the ranking limit", () => {
    expect(
      parseApprovedDashboardFilters({ rankLimit: "999" }).rankingLimit,
    ).toBe(50);
    expect(parseApprovedDashboardFilters({ rankLimit: "3" }).rankingLimit).toBe(
      10,
    );
    expect(
      parseApprovedDashboardFilters({ rankLimit: "25" }).rankingLimit,
    ).toBe(25);
  });

  it("rebuilds a shareable query without defaults", () => {
    const filters = parseApprovedDashboardFilters({
      q: "vaksin",
      orgType: "FASKES",
      page: "2",
    });
    expect(approvedDashboardQuery(filters)).toEqual({
      q: "vaksin",
      orgType: "FASKES",
      page: "2",
    });
    expect(approvedDashboardQuery(parseApprovedDashboardFilters({}))).toEqual(
      {},
    );
  });
});

describe("dashboard view anchors", () => {
  it("maps legacy content anchors onto the new sections", () => {
    expect(dashboardViewAnchor({ view: "konten" })).toBe("tabel");
    expect(dashboardViewAnchor({ view: "konten-disetujui" })).toBe("tabel");
    expect(dashboardViewAnchor({ view: "peta" })).toBe("peta");
    expect(dashboardViewAnchor({ view: "peringkat" })).toBe("peringkat");
    expect(dashboardViewAnchor({ view: "tren-tema" })).toBe("tren-tema");
  });

  it("returns null for unknown views", () => {
    expect(dashboardViewAnchor({ view: "lama" })).toBeNull();
    expect(dashboardViewAnchor({})).toBeNull();
  });
});
