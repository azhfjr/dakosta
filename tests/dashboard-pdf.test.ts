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

import type {
  DashboardBranchRow,
  DashboardCategory,
  DashboardCategoryTotals,
  DashboardFiltered,
  DashboardMapMissingRow,
  DashboardMapPoint,
  DashboardRankingRow,
  DashboardSummary,
  DashboardThemeRow,
} from "@/lib/dashboard/types";
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

function buildInput(
  branchCount: number,
  themeCount: number,
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
      branchName: `Cabang ${(index % Math.max(1, branchCount)) + 1}`,
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

  const summary: DashboardSummary = {
    totalApproved: branches.reduce((total, row) => total + row.total, 0),
    branches,
    branchCount: branches.length,
    branchesWithContent: branches.length,
    unassignedApproved: branches.length > 0 ? 5 : 0,
    selectionApplicable: true,
  };

  const categoryTotals = branches.reduce<DashboardCategoryTotals>(
    (totals, row) => {
      for (const category of CATEGORIES) {
        totals[category] += row.categories[category];
      }
      return totals;
    },
    { FKRTL: 0, FKTP: 0, PEMDA: 0, STAKEHOLDER: 0 },
  );

  const filtered: DashboardFiltered = {
    selection: { mode: "all", ids: branches.map((row) => row.id) },
    categoryTotals,
    rankings: {
      FKRTL: rankingRows("FKRTL"),
      FKTP: rankingRows("FKTP"),
      PEMDA: rankingRows("PEMDA"),
      STAKEHOLDER: rankingRows("STAKEHOLDER"),
    },
    edufast: summary.totalApproved,
    nonEdufast: themes.reduce((total, row) => total + row.total, 0),
    unclassifiedTheme: 0,
    nonEdufastThemes: themes,
    map: {
      points,
      missingLocations,
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
    scopeLabel: "Nasional",
    roleLabel: "Master Admin",
    selection: filtered.selection,
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
    scopeLabel: "Cabang Tanpa Data",
    roleLabel: "Admin Cabang",
    selection: { mode: "none", ids: [] },
    summary: {
      totalApproved: 0,
      branches: [],
      branchCount: 0,
      branchesWithContent: 0,
      unassignedApproved: 0,
      selectionApplicable: true,
    },
    filtered: {
      selection: { mode: "none", ids: [] },
      categoryTotals: { FKRTL: 0, FKTP: 0, PEMDA: 0, STAKEHOLDER: 0 },
      rankings: {
        FKRTL: [],
        FKTP: [],
        PEMDA: [],
        STAKEHOLDER: [],
      },
      edufast: 0,
      nonEdufast: 0,
      unclassifiedTheme: 0,
      nonEdufastThemes: [],
      map: {
        points: [],
        missingLocations: [],
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

describe("dashboard PDF export", () => {
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

    expect(plan.branchCount).toBe(60);
    expect(plan.aggregatedCount).toBe(45);
    expect(plan.branches).toHaveLength(16);
    expect(plan.branches.at(-1)).toMatchObject({
      id: "__aggregate__",
      aggregated: true,
      name: "Cabang lainnya (45)",
    });

    const planned = totalsOf(plan.branches);
    const source = totalsOf(input.summary.branches);
    expect(planned.total).toBe(source.total);
    expect(planned.categories).toEqual(source.categories);
  });

  it("keeps every branch when the list fits and aggregates the overflow only", () => {
    const exactlyInput = buildInput(18, 4);
    const exactly = planDashboardPage(exactlyInput);
    expect(exactly.branchCount).toBe(18);
    expect(exactly.branches).toHaveLength(18);
    expect(exactly.aggregatedCount).toBe(0);
    expect(exactly.branches.some((row) => row.aggregated)).toBe(false);
    expect(totalsOf(exactly.branches).total).toBe(
      totalsOf(exactlyInput.summary.branches).total,
    );

    const overflowInput = buildInput(19, 4);
    const overflow = planDashboardPage(overflowInput);
    expect(overflow.branches).toHaveLength(16);
    expect(overflow.aggregatedCount).toBe(4);
    expect(totalsOf(overflow.branches).categories).toEqual(
      totalsOf(overflowInput.summary.branches).categories,
    );
  });

  it("caps ranking panels and the theme legend at their page budgets", () => {
    const plan = planDashboardPage(fixture());
    for (const category of CATEGORIES) {
      expect(plan.rankings[category]).toHaveLength(10);
    }
    expect(plan.themes).toHaveLength(12);
    expect(plan.themeLegend).toHaveLength(10);
    expect(plan.hiddenThemes).toBe(2);
    expect(plan.selectionLabel).toBe("Semua cabang");
  });

  it("renders all charts except the map on exactly one A4 landscape page", async () => {
    const bytes = await renderDashboardPdf(fixture());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Dashboard DAKOSTA");
    expect(doc.getAuthor()).toBe("DAKOSTA");

    const [page] = doc.getPages();
    expect(page.getWidth()).toBeCloseTo(841.89, 1);
    expect(page.getHeight()).toBeCloseTo(595.28, 1);
    expect(xObjectCount(page)).toBeGreaterThan(0);

    const text = pageText(page);
    expect(text).toContain("Konten per Cabang");
    expect(text).toContain("Cabang lainnya (45)");
    expect(text).toContain("Institusi FKRTL Nomor 1");
    expect(text).toContain("Tema Konten 1");
    expect(text).not.toContain("Sebaran Institusi");
  }, 30_000);

  it("renders an explicit empty state on one page without throwing", async () => {
    const input = emptyFixture();
    const plan = planDashboardPage(input);
    expect(plan.branches).toEqual([]);
    expect(plan.aggregatedCount).toBe(0);
    expect(plan.themeLegend).toEqual([]);

    const bytes = await renderDashboardPdf(input);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const [page] = doc.getPages();
    expect(page.getWidth()).toBeCloseTo(841.89, 1);
    expect(page.getHeight()).toBeCloseTo(595.28, 1);
    expect(xObjectCount(page)).toBeGreaterThan(0);
    expect(pageText(page)).toContain("Belum ada cabang");
  }, 30_000);
});
