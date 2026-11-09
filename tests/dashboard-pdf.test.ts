import {
  PDFArray,
  PDFContentStream,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
  type PDFPage,
} from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { AppRole } from "@/lib/authz/types";
import type { BranchSelection } from "@/lib/filters/branch-selection";
import type {
  DashboardBranchRow,
  DashboardCategory,
  DashboardCategoryTotals,
  DashboardFiltered,
  DashboardInstitutionChart,
  DashboardInstitutionRow,
  DashboardMapMissingRow,
  DashboardMapPoint,
  DashboardMonthlySeries,
  DashboardRankingRow,
  DashboardSummary,
  DashboardThemeRow,
} from "@/lib/dashboard/types";
import { emptyMonthlySeries } from "@/lib/dashboard/series";
import {
  dashboardExportFilename,
  planDashboardPage,
  renderDashboardPdf,
  type DashboardPdfInput,
} from "@/lib/reports/dashboard-pdf";

const CATEGORIES: readonly DashboardCategory[] = [
  "FKRTL",
  "FKTP",
  "PEMDA",
  "STAKEHOLDER",
];

function xObjectCount(page: PDFPage) {
  const resources = page.node.Resources();
  if (!resources) return 0;
  const xObjects = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
  return xObjects ? xObjects.keys().length : 0;
}

/** Decodes the page content stream so tests can assert what was actually drawn. */
function pageText(page: PDFPage): string {
  const contents = page.node.Contents();
  if (!contents) return "";
  const streams =
    contents instanceof PDFArray ? contents.asArray() : [contents];
  const decoder = new TextDecoder("latin1");
  const raw = streams
    .map((entry) => {
      const stream = page.doc.context.lookup(entry);
      if (stream instanceof PDFRawStream) {
        return decoder.decode(decodePDFRawStream(stream).decode());
      }
      if (stream instanceof PDFContentStream) {
        return decoder.decode(stream.getUnencodedContents());
      }
      return "";
    })
    .join("\n");

  // pdf-lib writes drawn strings as hex-encoded WinAnsi operands.
  return [...raw.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)]
    .map((match) =>
      decoder.decode(
        Uint8Array.from(
          match[1].match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ??
            [],
        ),
      ),
    )
    .join("\n");
}

function branchRow(index: number): DashboardBranchRow {
  const categories: DashboardCategoryTotals = {
    FKRTL: (index % 5) + 1,
    FKTP: (index % 3) + 1,
    PEMDA: index % 2,
    STAKEHOLDER: index % 4 === 0 ? 1 : 0,
  };
  const total =
    categories.FKRTL +
    categories.FKTP +
    categories.PEMDA +
    categories.STAKEHOLDER;
  return {
    id: `branch-${index}`,
    name: `Cabang Wilayah Kerja Nomor ${index} dengan Nama Organisasi Panjang`,
    regionName: `Wilayah ${(index % 4) + 1}`,
    categories,
    total,
  };
}

function rankingRows(category: DashboardCategory): DashboardRankingRow[] {
  return Array.from({ length: 10 }, (_, index) => ({
    stakeholderId: `${category}-stakeholder-${index}`,
    name: `Institusi ${category} Nomor ${index + 1} dengan Nama Panjang`,
    branchId: `branch-${index + 1}`,
    branchName: `Cabang ${index + 1}`,
    total: 24 - index,
  }));
}

function institutionRow(index: number): DashboardInstitutionRow {
  const categories: DashboardCategoryTotals = {
    FKRTL: index % 3 === 0 ? 2 : 1,
    FKTP: index % 4 === 0 ? 2 : 1,
    PEMDA: index % 5 === 0 ? 1 : 0,
    STAKEHOLDER: index % 6 === 0 ? 1 : 0,
  };
  return {
    id: `institution-${index}`,
    name: `Institusi Tervalidasi Nomor ${index} dengan Nama Organisasi Panjang`,
    branchName: "Cabang 1",
    total:
      categories.FKRTL +
      categories.FKTP +
      categories.PEMDA +
      categories.STAKEHOLDER,
    categories,
  };
}

function institutionChartFixture(): DashboardInstitutionChart {
  return {
    total: 15,
    rows: Array.from({ length: 12 }, (_, index) => institutionRow(index + 1)),
    remaining: {
      count: 3,
      total: 14,
      categories: { FKRTL: 6, FKTP: 5, PEMDA: 2, STAKEHOLDER: 1 },
    },
  };
}

function monthlyFixture(total: number): DashboardMonthlySeries {
  const series = emptyMonthlySeries(new Date("2026-11-09T01:00:00Z"));
  const per = Math.floor(total / series.points.length);
  return {
    ...series,
    points: series.points.map((point) => ({ ...point, total: per })),
    total: per * series.points.length,
  };
}

function buildInput(
  branchCount: number,
  themeCount: number,
  role: AppRole = "MASTER_ADMIN",
): DashboardPdfInput {
  const branches = Array.from({ length: branchCount }, (_, index) =>
    branchRow(index + 1),
  );
  const themes: DashboardThemeRow[] = Array.from(
    { length: themeCount },
    (_, index) => ({
      key: `TEMA_${index + 1}`,
      label: `Tema Konten ${index + 1}`,
      total: Math.max(1, 40 - index * 3),
      percentage: 100 / Math.max(1, themeCount),
    }),
  );
  const points: DashboardMapPoint[] = Array.from(
    { length: 20 },
    (_, index) => ({
      id: `point-${index}`,
      name: `Institusi ${index + 1}`,
      branchId: `branch-${(index % Math.max(1, branchCount)) + 1}`,
      branchName: `Cabang ${(index % Math.max(1, branchCount)) + 1}`,
      regionId: `region-${(index % 4) + 1}`,
      regionName: `Wilayah ${(index % 4) + 1}`,
      latitude: -6.4 + (index % 5) * 0.08,
      longitude: 106.6 + Math.floor(index / 5) * 0.15,
      total: 1 + (index % 7),
      categories: {
        FKRTL: index % 2 === 0 ? 1 : 0,
        FKTP: index % 3 === 0 ? 1 : 0,
        PEMDA: index % 5 === 0 ? 1 : 0,
        STAKEHOLDER: index % 7 === 0 ? 1 : 0,
      },
    }),
  );
  const missingLocations: DashboardMapMissingRow[] = Array.from(
    { length: 3 },
    (_, index) => ({
      id: `missing-${index}`,
      name: `Institusi Tanpa Lokasi ${index + 1}`,
      branchName: `Cabang ${index + 1}`,
      total: 2,
    }),
  );

  const categoryTotals = branches.reduce<DashboardCategoryTotals>(
    (totals, row) => {
      for (const category of CATEGORIES) {
        totals[category] += row.categories[category];
      }
      return totals;
    },
    { FKRTL: 0, FKTP: 0, PEMDA: 0, STAKEHOLDER: 0 },
  );

  const summary: DashboardSummary = {
    totalApproved: branches.reduce((total, row) => total + row.total, 0),
    categoryTotals,
    categoryShares: { FKRTL: 40, FKTP: 30, PEMDA: 20, STAKEHOLDER: 10 },
    branches,
    branchCount: branches.length,
    branchesWithContent: branches.length,
    unassignedApproved: branches.length > 0 ? 5 : 0,
    selectionApplicable: true,
  };

  const fixedScope = role === "BRANCH_ADMIN" || role === "STAKEHOLDER";
  const selection: BranchSelection = fixedScope
    ? { mode: "not-applicable", ids: [] }
    : { mode: "all", ids: branches.map((row) => row.id) };

  const filtered: DashboardFiltered = {
    selection,
    categoryTotals,
    rankings: {
      FKRTL: rankingRows("FKRTL"),
      FKTP: rankingRows("FKTP"),
      PEMDA: rankingRows("PEMDA"),
      STAKEHOLDER: rankingRows("STAKEHOLDER"),
    },
    institutionChart: institutionChartFixture(),
    edufast: summary.totalApproved,
    nonEdufast: themes.reduce((total, row) => total + row.total, 0),
    unclassifiedTheme: 0,
    nonEdufastThemes: themes,
    monthly: monthlyFixture(120),
    contentTypes: [
      { type: "VIDEO", label: "Video", total: 70, share: 58.3 },
      { type: "INFOGRAFIS", label: "Infografis", total: 50, share: 41.7 },
    ],
    typeMonthly: [
      {
        type: "VIDEO",
        label: "Video",
        points: monthlyFixture(70).points,
        total: 70,
      },
      {
        type: "INFOGRAFIS",
        label: "Infografis",
        points: monthlyFixture(50).points,
        total: 50,
      },
    ],
    themeMonthly: [
      {
        key: "EDUFAST",
        label: "EDUFAST",
        points: monthlyFixture(80).points,
        total: 80,
      },
      {
        key: "NON_EDUFAST",
        label: "Non-EDUFAST",
        points: monthlyFixture(40).points,
        total: 40,
      },
    ],
    map: {
      points,
      branches: [],
      regions: [],
      missingLocations,
      maxTotal: 7,
      totals: {
        approved: summary.totalApproved,
        mappedApproved: 20,
        missingApproved: 6,
        institutions: 23,
        mappedInstitutions: 20,
        missingInstitutions: 3,
        truncated: false,
      },
    },
    generatedAt: "2026-11-09T01:00:00.000Z",
  };

  return {
    role,
    scopeLabel: "Nasional",
    roleLabel: "Master Admin",
    selection,
    summary,
    filtered,
    generatedAt: new Date("2026-11-09T01:00:00Z"),
  };
}

function fixture(): DashboardPdfInput {
  return buildInput(60, 12);
}

function emptyFixture(): DashboardPdfInput {
  return {
    role: "BRANCH_ADMIN",
    scopeLabel: "Cabang Tanpa Data",
    roleLabel: "Admin Cabang",
    selection: { mode: "not-applicable", ids: [] },
    summary: {
      totalApproved: 0,
      categoryTotals: { FKRTL: 0, FKTP: 0, PEMDA: 0, STAKEHOLDER: 0 },
      categoryShares: { FKRTL: 0, FKTP: 0, PEMDA: 0, STAKEHOLDER: 0 },
      branches: [],
      branchCount: 0,
      branchesWithContent: 0,
      unassignedApproved: 0,
      selectionApplicable: true,
    },
    filtered: {
      selection: { mode: "not-applicable", ids: [] },
      categoryTotals: { FKRTL: 0, FKTP: 0, PEMDA: 0, STAKEHOLDER: 0 },
      rankings: {
        FKRTL: [],
        FKTP: [],
        PEMDA: [],
        STAKEHOLDER: [],
      },
      institutionChart: { total: 0, rows: [], remaining: null },
      edufast: 0,
      nonEdufast: 0,
      unclassifiedTheme: 0,
      nonEdufastThemes: [],
      monthly: monthlyFixture(0),
      contentTypes: [],
      typeMonthly: [],
      themeMonthly: [],
      map: {
        points: [],
        branches: [],
        regions: [],
        missingLocations: [],
        maxTotal: 0,
        totals: {
          approved: 0,
          mappedApproved: 0,
          missingApproved: 0,
          institutions: 0,
          mappedInstitutions: 0,
          missingInstitutions: 0,
          truncated: false,
        },
      },
      generatedAt: "2026-11-09T01:00:00.000Z",
    },
    generatedAt: new Date("2026-11-09T01:00:00Z"),
  };
}

function totalsOf(
  rows: Array<{ categories: DashboardCategoryTotals; total: number }>,
) {
  const categories: DashboardCategoryTotals = {
    FKRTL: 0,
    FKTP: 0,
    PEMDA: 0,
    STAKEHOLDER: 0,
  };
  let total = 0;
  for (const row of rows) {
    for (const category of CATEGORIES) {
      categories[category] += row.categories[category];
    }
    total += row.total;
  }
  return { categories, total };
}

describe("dashboard PDF export (role variants)", () => {
  it("names the file by role and UTC date", () => {
    expect(
      dashboardExportFilename("MASTER_ADMIN", new Date("2026-11-09T01:00:00Z")),
    ).toBe("dashboard-dakosta-master_admin-2026-11-09.pdf");
    expect(
      dashboardExportFilename("STAKEHOLDER", new Date("2026-11-09T01:00:00Z")),
    ).toBe("dashboard-dakosta-stakeholder-2026-11-09.pdf");
  });

  it("aggregates branches beyond the row budget without losing totals", () => {
    const input = fixture();
    const plan = planDashboardPage(input);

    expect(plan.variant).toBe("national");
    expect(plan.chartTitle).toBe("Konten per Cabang");
    expect(plan.chartCount).toBe(60);
    expect(plan.aggregatedCount).toBe(45);
    expect(plan.chartRows).toHaveLength(16);
    expect(plan.chartRows.at(-1)).toMatchObject({
      id: "__aggregate__",
      aggregated: true,
      name: "Cabang lainnya (45)",
    });

    const planned = totalsOf(plan.chartRows);
    const source = totalsOf(input.summary.branches);
    expect(planned.total).toBe(source.total);
    expect(planned.categories).toEqual(source.categories);
  });

  it("keeps every branch when the list fits and aggregates the overflow only", () => {
    const exactlyInput = buildInput(16, 4);
    const exactly = planDashboardPage(exactlyInput);
    expect(exactly.chartCount).toBe(16);
    expect(exactly.chartRows).toHaveLength(16);
    expect(exactly.aggregatedCount).toBe(0);
    expect(exactly.chartRows.some((row) => row.aggregated)).toBe(false);
    expect(totalsOf(exactly.chartRows).total).toBe(
      totalsOf(exactlyInput.summary.branches).total,
    );

    const overflowInput = buildInput(17, 4);
    const overflow = planDashboardPage(overflowInput);
    expect(overflow.chartRows).toHaveLength(16);
    expect(overflow.aggregatedCount).toBe(2);
    expect(totalsOf(overflow.chartRows).categories).toEqual(
      totalsOf(overflowInput.summary.branches).categories,
    );
  });

  it("plans institution bars for branch dashboards", () => {
    const input = buildInput(8, 6, "BRANCH_ADMIN");
    const plan = planDashboardPage(input);
    const chart = input.filtered.institutionChart;
    const expected = totalsOf([
      ...chart.rows,
      ...(chart.remaining
        ? [
            {
              categories: chart.remaining.categories,
              total: chart.remaining.total,
            },
          ]
        : []),
    ]);

    expect(plan.variant).toBe("branch");
    expect(plan.chartTitle).toBe("Konten per Institusi");
    expect(plan.chartCount).toBe(chart.total);
    expect(plan.chartRows).toHaveLength(13);
    expect(plan.chartRows.at(-1)).toMatchObject({
      id: "__aggregate__",
      aggregated: true,
      name: "Institusi lainnya (3)",
    });
    expect(plan.selectionLabel).toBe("Seluruh data dalam cakupan");
    expect(totalsOf(plan.chartRows).total).toBe(expected.total);
    expect(totalsOf(plan.chartRows).categories).toEqual(expected.categories);
  });

  it("caps ranking panels and the theme legend at their page budgets", () => {
    const plan = planDashboardPage(fixture());
    for (const category of CATEGORIES) {
      expect(plan.rankings[category]).toHaveLength(8);
    }
    expect(plan.themes).toHaveLength(12);
    expect(plan.themeLegend).toHaveLength(10);
    expect(plan.hiddenThemes).toBe(2);
    expect(plan.selectionLabel).toBe("Semua cabang");
  });

  it("drops the chart and rankings for stakeholders", () => {
    const plan = planDashboardPage(buildInput(8, 14, "STAKEHOLDER"));

    expect(plan.variant).toBe("stakeholder");
    expect(plan.chartTitle).toBe("");
    expect(plan.chartRows).toEqual([]);
    expect(plan.aggregatedCount).toBe(0);
    for (const category of CATEGORIES) {
      expect(plan.rankings[category]).toEqual([]);
    }
    expect(plan.themeLegend).toHaveLength(14);
    expect(plan.hiddenThemes).toBe(0);
    expect(plan.selectionLabel).toBe("Seluruh data dalam cakupan");
  });

  it("renders exactly one A4 landscape page for every role", async () => {
    const inputs = [
      buildInput(60, 12, "MASTER_ADMIN"),
      buildInput(8, 12, "REGIONAL_ADMIN"),
      buildInput(8, 12, "BRANCH_ADMIN"),
      buildInput(8, 14, "STAKEHOLDER"),
    ];

    for (const input of inputs) {
      const bytes = await renderDashboardPdf(input);
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      const [page] = doc.getPages();
      expect(page.getWidth()).toBeCloseTo(841.89, 1);
      expect(page.getHeight()).toBeCloseTo(595.28, 1);
      expect(xObjectCount(page)).toBeGreaterThan(0);
    }
  }, 60_000);

  it("renders the national chart, rankings, and themes without ranking percentages", async () => {
    const bytes = await renderDashboardPdf(fixture());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("Dashboard DAKOSTA");
    expect(doc.getAuthor()).toBe("DAKOSTA");

    const [page] = doc.getPages();
    const text = pageText(page);
    expect(text).toContain("Konten per Cabang");
    expect(text).toContain("Cabang lainnya (45)");
    expect(text).toContain("Institusi FKRTL Nomor 1");
    expect(text).toContain("Tema Konten 1");
    expect(text).toContain("Tren Bulanan");
    expect(text).not.toContain("Sebaran Institusi");

    const standalonePercent = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+(?:[.,]\d+)?%$/.test(line));
    expect(standalonePercent).toEqual([]);
  }, 30_000);

  it("renders institution bars for branch dashboards", async () => {
    const bytes = await renderDashboardPdf(buildInput(8, 6, "BRANCH_ADMIN"));
    const doc = await PDFDocument.load(bytes);
    const text = pageText(doc.getPages()[0]);
    expect(text).toContain("Konten per Institusi");
    expect(text).toContain("Institusi lainnya (3)");
    expect(text).toContain("Institusi Tervalidasi Nomor 1");
    expect(text).not.toContain("Konten per Cabang");
  }, 30_000);

  it("renders only KPIs, content types, themes, and trend for stakeholders", async () => {
    const bytes = await renderDashboardPdf(buildInput(8, 14, "STAKEHOLDER"));
    const doc = await PDFDocument.load(bytes);
    const text = pageText(doc.getPages()[0]);
    expect(text).toContain("Total Konten Tervalidasi");
    expect(text).toContain("Konten EDUFAST");
    expect(text).toContain("Konten Non-EDUFAST");
    expect(text).toContain("Jenis Konten");
    expect(text).toContain("Video");
    expect(text).toContain("Infografis");
    expect(text).toContain("Tren Bulanan");
    expect(text).toContain("Tema Konten 1");
    expect(text).not.toContain("Institusi dengan Konten");
    expect(text).not.toContain("Konten per Cabang");
    expect(text).not.toContain("Konten per Institusi");
    expect(text).not.toContain("Institusi FKRTL Nomor 1");
  }, 30_000);

  it("renders an explicit empty state on one page without throwing", async () => {
    const input = emptyFixture();
    const plan = planDashboardPage(input);
    expect(plan.chartRows).toEqual([]);
    expect(plan.aggregatedCount).toBe(0);
    expect(plan.themeLegend).toEqual([]);

    const bytes = await renderDashboardPdf(input);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const [page] = doc.getPages();
    expect(page.getWidth()).toBeCloseTo(841.89, 1);
    expect(page.getHeight()).toBeCloseTo(595.28, 1);
    expect(xObjectCount(page)).toBeGreaterThan(0);
    expect(pageText(page)).toContain("Belum ada institusi");
  }, 30_000);
});
