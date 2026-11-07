import "server-only";

import { PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";

import { formatDateId, formatDateTimeId } from "@/lib/dates";
import {
  performanceSourceLabel,
  type PerformanceFilters,
  type PerformanceRow,
  type PerformanceSummary,
} from "@/lib/performance";
import {
  REPORT_COLORS,
  REPORT_CONTENT_WIDTH,
  REPORT_PAGE,
  drawReportFooter,
  drawReportHeader,
  fitText,
  formatNumber,
  loadBrandLogo,
  loadReportFonts,
  safe,
  setReportMetadata,
} from "@/lib/reports/pdf-kit";

const PAGE_WIDTH = REPORT_PAGE.width;
const PAGE_HEIGHT = REPORT_PAGE.height;
const MARGIN = REPORT_PAGE.margin;
const CONTENT_WIDTH = REPORT_CONTENT_WIDTH;
const TABLE_HEADER_HEIGHT = 18;
const ROW_HEIGHT = 14;
const BOTTOM_LIMIT = 40;

const GREEN = REPORT_COLORS.brand;
const INK = REPORT_COLORS.ink;
const MUTED = REPORT_COLORS.muted;
const LINE = REPORT_COLORS.line;
const SURFACE = REPORT_COLORS.surface;

function percent(value: number | null): string {
  if (value === null) return "N/A";
  return `${formatNumber(Math.round(value * 10) / 10)}%`;
}

const STATUS_LABEL: Record<PerformanceRow["status"], string> = {
  MET: "Tercapai",
  BELOW: "Di bawah target",
  NO_TARGET: "Belum ditetapkan",
};

const COLUMNS: Array<{
  label: string;
  width: number;
  align?: "right";
}> = [
  { label: "Kedeputian", width: 72 },
  { label: "Cabang", width: 78 },
  { label: "Instansi", width: 178 },
  { label: "Jenis", width: 58 },
  { label: "Target", width: 42, align: "right" },
  { label: "Realisasi", width: 50, align: "right" },
  { label: "Selisih", width: 44, align: "right" },
  { label: "Capaian", width: 46, align: "right" },
  { label: "Status", width: 86 },
  { label: "Periode", width: 64 },
  { label: "Diperbarui", width: 44 },
];

function drawTableHeader(page: PDFPage, bold: PDFFont, y: number): void {
  page.drawRectangle({
    x: MARGIN,
    y: y - TABLE_HEADER_HEIGHT + 3,
    width: CONTENT_WIDTH,
    height: TABLE_HEADER_HEIGHT,
    color: SURFACE,
  });
  let x = MARGIN + 3;
  for (const column of COLUMNS) {
    const text = safe(column.label);
    const textWidth = bold.widthOfTextAtSize(text, 6.8);
    page.drawText(text, {
      x: column.align === "right" ? x + column.width - textWidth - 6 : x,
      y: y - 9,
      size: 6.8,
      font: bold,
      color: MUTED,
    });
    x += column.width;
  }
  page.drawLine({
    start: { x: MARGIN, y: y - TABLE_HEADER_HEIGHT + 2 },
    end: { x: PAGE_WIDTH - MARGIN, y: y - TABLE_HEADER_HEIGHT + 2 },
    thickness: 0.5,
    color: LINE,
  });
}

function drawRow(
  page: PDFPage,
  font: PDFFont,
  row: PerformanceRow,
  y: number,
  periodLabel: string,
): void {
  const values = [
    row.regionName ?? "-",
    row.branchName ?? "-",
    row.name,
    row.sourceLabel,
    row.target === null ? "N/A" : formatNumber(row.target),
    formatNumber(row.approved),
    row.difference === null
      ? "N/A"
      : row.difference === 0
        ? "0"
        : `${row.difference > 0 ? "+" : "-"}${formatNumber(Math.abs(row.difference))}`,
    percent(row.achievement),
    STATUS_LABEL[row.status],
    periodLabel,
    row.updatedAt ? formatDateId(row.updatedAt) : "-",
  ];

  let x = MARGIN + 3;
  values.forEach((value, index) => {
    const column = COLUMNS[index]!;
    const text = fitText(font, value, 6.5, column.width - 8);
    const textWidth = font.widthOfTextAtSize(text, 6.5);
    page.drawText(text, {
      x: column.align === "right" ? x + column.width - textWidth - 6 : x,
      y,
      size: 6.5,
      font,
      color: INK,
    });
    x += column.width;
  });
}

export async function renderPerformancePdf(input: {
  scopeLabel: string;
  roleLabel: string;
  filters: PerformanceFilters;
  rows: PerformanceRow[];
  summary: PerformanceSummary;
  generatedAt: Date;
}): Promise<Uint8Array> {
  const { filters, rows, summary } = input;
  const doc = await PDFDocument.create();
  setReportMetadata(doc, {
    title: `Laporan Kinerja ${filters.period.label}`,
    subject: "Laporan kinerja per instansi",
  });

  const fonts = await loadReportFonts(doc);
  const { font, bold } = fonts;
  const logo = await loadBrandLogo(doc);

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const headerTop = drawReportHeader(page, fonts, logo, {
    title: "Laporan Kinerja per Instansi",
    subtitle: `Periode ${filters.period.label}`,
  });

  let y = headerTop - 18;
  page.drawText(
    safe(`Cakupan: ${input.scopeLabel} - Peran: ${input.roleLabel}`),
    { x: MARGIN, y, size: 8, font, color: MUTED },
  );
  y -= 12;
  page.drawText(
    safe(
      `Dibuat: ${formatDateTimeId(input.generatedAt)} WIB - Filter: ${performanceSourceLabel(
        filters.source,
      )}${filters.q ? ` - Pencarian: ${filters.q}` : ""} - Status: ${
        filters.status === "ALL" ? "semua" : filters.status
      }`,
    ),
    { x: MARGIN, y, size: 7.5, font, color: MUTED },
  );
  y -= 18;

  const cards: Array<[string, string]> = [
    ["Institusi", formatNumber(summary.institutions)],
    [
      "Target terisi",
      `${formatNumber(summary.withTarget)} / ${formatNumber(summary.institutions)}`,
    ],
    ["Realisasi approved", formatNumber(summary.approved)],
    ["Capaian agregat", percent(summary.achievement)],
    [
      "Target tercapai",
      `${formatNumber(summary.met)} / ${formatNumber(summary.withTarget)}`,
    ],
  ];
  const cardWidth = (CONTENT_WIDTH - 8 * (cards.length - 1)) / cards.length;
  cards.forEach(([label, value], index) => {
    const x = MARGIN + index * (cardWidth + 8);
    page.drawRectangle({
      x,
      y: y - 30,
      width: cardWidth,
      height: 34,
      color: SURFACE,
    });
    page.drawText(safe(label), {
      x: x + 8,
      y: y - 10,
      size: 6.8,
      font,
      color: MUTED,
    });
    page.drawText(safe(value), {
      x: x + 8,
      y: y - 24,
      size: 11,
      font: bold,
      color: GREEN,
    });
  });
  y -= 46;

  drawTableHeader(page, bold, y);
  y -= TABLE_HEADER_HEIGHT;

  let current = page;
  for (const row of rows) {
    if (y - ROW_HEIGHT < BOTTOM_LIMIT) {
      current = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const top = drawReportHeader(current, fonts, logo, {
        title: "Laporan Kinerja per Instansi (lanjutan)",
        subtitle: `Periode ${filters.period.label}`,
      });
      y = top - 12;
      drawTableHeader(current, bold, y);
      y -= TABLE_HEADER_HEIGHT;
    }
    drawRow(current, font, row, y - 10, filters.period.label);
    current.drawLine({
      start: { x: MARGIN, y: y - ROW_HEIGHT + 1 },
      end: { x: PAGE_WIDTH - MARGIN, y: y - ROW_HEIGHT + 1 },
      thickness: 0.3,
      color: LINE,
    });
    y -= ROW_HEIGHT;
  }

  if (rows.length === 0) {
    current.drawText("Tidak ada institusi yang cocok dengan filter.", {
      x: MARGIN,
      y: y - 14,
      size: 8,
      font,
      color: MUTED,
    });
    y -= 26;
  }

  y -= 8;
  if (y < BOTTOM_LIMIT + 16) {
    current = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const top = drawReportHeader(current, fonts, logo, {
      title: "Laporan Kinerja per Instansi (lanjutan)",
      subtitle: `Periode ${filters.period.label}`,
    });
    y = top - 16;
  }
  current.drawText(
    safe(
      "Realisasi = COUNT(DISTINCT konten) berstatus approved berdasarkan tanggal approval final dalam periode. Target per instansi = penjumlahan target bulanan; target kosong ditampilkan N/A, bukan 0.",
    ),
    { x: MARGIN, y, size: 6.8, font, color: MUTED },
  );

  const pages = doc.getPages();
  pages.forEach((item, index) => {
    drawReportFooter(item, fonts, logo, {
      pageNumber: index + 1,
      totalPages: pages.length,
      metadata: `Laporan Kinerja - ${filters.period.label}`,
    });
  });

  return doc.save();
}
