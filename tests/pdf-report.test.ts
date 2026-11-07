import {
  PDFDict,
  PDFDocument,
  PDFName,
  StandardFonts,
  type PDFPage,
} from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { AnalyticsContentRow } from "@/lib/analytics/content-table";
import { parseKontenFilters } from "@/lib/filters/konten";
import {
  CONTENT_REPORT_ROW_CAP,
  renderContentReportPdf,
} from "@/lib/reports/content-pdf";
import { fitText, safe, wrapText } from "@/lib/reports/pdf-kit";

const FONT_SIZE = 7;
const MAX_WIDTH = 120;

async function helvetica() {
  const doc = await PDFDocument.create();
  return doc.embedFont(StandardFonts.Helvetica);
}

function row(
  index: number,
  overrides: Partial<AnalyticsContentRow> = {},
): AnalyticsContentRow {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    referenceCode: `KTN-${String(index).padStart(5, "0")}`,
    title: `Sosialisasi Program Jaminan Kesehatan Nasional wilayah kerja nomor ${index}`,
    organization: "Klinik Pratama Sehat Bersama",
    branchName: "Cabang Jakarta Selatan",
    organizationType: "FASKES",
    faskesClass: "PRATAMA",
    source: "FASKES_FKTP",
    sourceLabel: "Faskes",
    contentType: "VIDEO",
    mainTheme: "EDUFAST",
    subTheme: "EDUKATIF_PERSUASIF",
    platform: "INSTAGRAM",
    status: "APPROVED",
    dateCreated: "2026-10-01",
    submittedAt: new Date("2026-10-02T03:00:00Z"),
    approvedAt: new Date("2026-10-05T04:00:00Z"),
    decisionAt: new Date("2026-10-05T04:00:00Z"),
    decidedBy: "Admin Cabang",
    decisionSource: "BRANCH",
    version: 1,
    resubmissionCount: 0,
    publishedUrl: null,
    ...overrides,
  };
}

function xObjectCount(page: PDFPage) {
  const resources = page.node.Resources();
  if (!resources) return 0;
  const xObjects = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
  return xObjects ? xObjects.keys().length : 0;
}

describe("pdf-kit text model", () => {
  it("maps unsupported punctuation instead of throwing", () => {
    expect(safe("Konten · capaian – 92% — “baik”")).toBe(
      'Konten - capaian - 92% - "baik"',
    );
  });

  it("wraps long text inside the column width", async () => {
    const font = await helvetica();
    const lines = wrapText(
      font,
      "Sosialisasi Program Jaminan Kesehatan Nasional untuk peserta mandiri di wilayah kerja Jakarta Selatan",
      FONT_SIZE,
      MAX_WIDTH,
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, FONT_SIZE)).toBeLessThanOrEqual(
        MAX_WIDTH,
      );
    }
    expect(lines.join(" ")).toContain("Jaminan Kesehatan Nasional");
  });

  it("hard-breaks a token that cannot fit on one line", async () => {
    const font = await helvetica();
    const lines = wrapText(font, "X".repeat(200), FONT_SIZE, MAX_WIDTH);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, FONT_SIZE)).toBeLessThanOrEqual(
        MAX_WIDTH,
      );
    }
  });

  it("truncates single-line cells with an ellipsis", async () => {
    const font = await helvetica();
    const text = fitText(
      font,
      "Klinik Pratama Sehat Bersama Cabang Jakarta",
      7,
      60,
    );
    expect(text.endsWith("...")).toBe(true);
    expect(font.widthOfTextAtSize(text, 7)).toBeLessThanOrEqual(60);
  });
});

describe("content report renderer", () => {
  const filters = parseKontenFilters({}, "approved");

  it("renders one page with metadata for an empty result", async () => {
    const bytes = await renderContentReportPdf({
      scopeLabel: "Nasional",
      roleLabel: "Master Admin",
      filters,
      rows: [],
      total: 0,
      generatedAt: new Date("2026-11-07T01:00:00Z"),
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Laporan Detail Konten Disetujui");
    expect(doc.getAuthor()).toBe("DAKOSTA");
    const [page] = doc.getPages();
    expect(page.getWidth()).toBeCloseTo(841.89, 1);
    expect(page.getHeight()).toBeCloseTo(595.28, 1);
    // Header and footer both embed the brand logo on the page.
    expect(xObjectCount(page!)).toBeGreaterThan(0);
  });

  it("paginates long datasets and repeats the header logo on every page", async () => {
    const rows = Array.from({ length: 180 }, (_, index) => row(index + 1));
    const bytes = await renderContentReportPdf({
      scopeLabel: "Wilayah Jakarta",
      roleLabel: "Admin Wilayah",
      filters,
      rows,
      total: rows.length,
      generatedAt: new Date("2026-11-07T01:00:00Z"),
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    for (const page of doc.getPages()) {
      expect(page.getWidth()).toBeCloseTo(841.89, 1);
      expect(xObjectCount(page)).toBeGreaterThan(0);
    }
  });

  it("keeps the row cap explicit", () => {
    expect(CONTENT_REPORT_ROW_CAP).toBe(2000);
  });
});
