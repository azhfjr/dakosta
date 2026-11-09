import { describe, expect, it } from "vitest";

import {
  dashboardSections,
  dashboardVariant,
  dashboardViewAnchor,
  selectionForDashboard,
} from "@/lib/dashboard/variant";

const ALLOWED = ["branch-a", "branch-b"];

describe("dashboardVariant", () => {
  it("maps each role to its dashboard level", () => {
    expect(dashboardVariant("MASTER_ADMIN")).toBe("national");
    expect(dashboardVariant("REGIONAL_ADMIN")).toBe("regional");
    expect(dashboardVariant("BRANCH_ADMIN")).toBe("branch");
    expect(dashboardVariant("STAKEHOLDER")).toBe("stakeholder");
  });
});

describe("dashboardSections", () => {
  it("keeps national and regional dashboards at branch level", () => {
    expect(dashboardSections("national")).toEqual([
      "ringkasan",
      "konten-per-cabang",
      "tren-bulanan",
      "kolaborasi",
      "peta",
      "tema-konten",
    ]);
    expect(dashboardSections("regional")).toEqual(
      dashboardSections("national"),
    );
  });

  it("replaces the branch chart with the institution chart for a branch", () => {
    const sections = dashboardSections("branch");
    expect(sections).toContain("konten-per-institusi");
    expect(sections).not.toContain("konten-per-cabang");
    expect(sections).toContain("tren-bulanan");
    expect(sections).toContain("kolaborasi");
    expect(sections).toContain("peta");
  });

  it("gives a stakeholder type and theme analytics instead of institution views", () => {
    expect(dashboardSections("stakeholder")).toEqual([
      "ringkasan",
      "jenis-konten",
      "tren-bulanan",
      "tren-jenis-konten",
      "tren-tema",
      "tema-konten",
    ]);
  });
});

describe("selectionForDashboard", () => {
  it("parses the branch filter for national and regional dashboards", () => {
    expect(selectionForDashboard("national", {}, ALLOWED)).toEqual({
      mode: "all",
      ids: ALLOWED,
    });
    expect(
      selectionForDashboard("regional", { cabang: "branch-a" }, ALLOWED),
    ).toEqual({ mode: "subset", ids: ["branch-a"] });
    expect(
      selectionForDashboard("national", { cabang: "none" }, ALLOWED),
    ).toEqual({ mode: "none", ids: [] });
  });

  it("ignores the branch filter for branch and stakeholder dashboards", () => {
    expect(
      selectionForDashboard("branch", { cabang: "none" }, ALLOWED),
    ).toEqual({ mode: "not-applicable", ids: [] });
    expect(
      selectionForDashboard("stakeholder", { cabang: "none" }, ALLOWED),
    ).toEqual({ mode: "not-applicable", ids: [] });
  });
});

describe("dashboardViewAnchor", () => {
  it("keeps legacy anchors working for national dashboards", () => {
    expect(dashboardViewAnchor({ view: "konten" })).toBe("kolaborasi");
    expect(dashboardViewAnchor({ view: "pencapaian" })).toBe(
      "konten-per-cabang",
    );
    expect(dashboardViewAnchor({ view: "lama" })).toBeNull();
  });

  it("points branch deep links at the institution chart", () => {
    expect(dashboardViewAnchor({ view: "pencapaian" }, "branch")).toBe(
      "konten-per-institusi",
    );
    expect(dashboardViewAnchor({ view: "konten-per-cabang" }, "branch")).toBe(
      "konten-per-institusi",
    );
    expect(dashboardViewAnchor({ view: "pilih-cabang" }, "branch")).toBe(
      "ringkasan",
    );
  });

  it("falls back to the summary for sections a stakeholder does not have", () => {
    expect(dashboardViewAnchor({ view: "pencapaian" }, "stakeholder")).toBe(
      "ringkasan",
    );
    expect(dashboardViewAnchor({ view: "peta" }, "stakeholder")).toBe(
      "ringkasan",
    );
    expect(dashboardViewAnchor({ view: "tema-konten" }, "stakeholder")).toBe(
      "tema-konten",
    );
    expect(dashboardViewAnchor({ view: "jenis-konten" }, "stakeholder")).toBe(
      "jenis-konten",
    );
    expect(dashboardViewAnchor({ view: "tren-tema" }, "stakeholder")).toBe(
      "tren-tema",
    );
  });

  it("maps new analytics views onto the sections each role actually has", () => {
    expect(dashboardViewAnchor({ view: "tren-bulanan" }, "branch")).toBe(
      "tren-bulanan",
    );
    expect(dashboardViewAnchor({ view: "jenis-platform" }, "national")).toBe(
      "tema-konten",
    );
    expect(dashboardViewAnchor({ view: "jenis-konten" }, "stakeholder")).toBe(
      "jenis-konten",
    );
    expect(
      dashboardViewAnchor({ view: "tren-jenis-platform" }, "stakeholder"),
    ).toBe("tren-jenis-konten");
  });
});
