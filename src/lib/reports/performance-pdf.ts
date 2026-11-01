import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { formatDateId, formatDateTimeId } from "@/lib/dates";
import {
  performanceSourceLabel,
  type PerformanceFilters,
  type PerformanceRow,
  type PerformanceSummary,
} from "@/lib/performance";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 74;
const TABLE_HEADER_HEIGHT = 18;
const ROW_HEIGHT = 14;

const GREEN = rgb(0, 0.42, 0.235);
const INK = rgb(0.07, 0.165, 0.22);
const MUTED = rgb(0.31, 0.404, 0.475);
const LINE = rgb(0.85, 0.9, 0.88);
const SURFACE = rgb(0.965, 0.98, 0.972);

const REPLACEMENTS: Record<string, string> = {
  "·": "-",
  "–": "-",
  "—": "-",
  "…": "...",
  "×": "x",
  "’": "'",
  "‘": "'",
  "“": '"',
  "”": '"',
  "→": "->",
  "≥": ">=",
  "≤": "<=",
  "•": "-",
  "\u00a0": " ",
};

function safe(value: string): string {
  return value
    .replace(/[·–—…×’‘“”≥≤•\u00a0]/g, (char) => REPLACEMENTS[char] ?? "")
    .replace(/[^\x20-\x7E]/g, "");
}

function number(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function percent(value: number | null): string {
  if (value === null) return "N/A";
  return `${number(Math.round(value * 10) / 10)}%`;
}

function fit(
  font: PDFFont,
  value: string,
  size: number,
  maxWidth: number,
): string {
  const clean = safe(value);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let result = clean;
  while (
    result.length > 1 &&
    font.widthOfTextAtSize(`${result}...`, size) > maxWidth
  ) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
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

function drawPageBand(page: PDFPage): void {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 5,
    width: PAGE_WIDTH,
    height: 5,
    color: GREEN,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_HEIGHT,
    width: PAGE_WIDTH,
    height: HEADER_HEIGHT - 5,
    color: GREEN,
  });
}

function drawFooter(
  page: PDFPage,
  font: PDFFont,
  pageNumber: number,
  total: number,
  periodLabel: string,
): void {
  page.drawLine({
    start: { x: MARGIN, y: 26 },
    end: { x: PAGE_WIDTH - MARGIN, y: 26 },
    thickness: 0.5,
    color: LINE,
  });
  page.drawText(
    safe(
      `DAKOSTA - Laporan Kinerja - ${periodLabel} - Halaman ${pageNumber} dari ${total}`,
    ),
    { x: MARGIN, y: 15, size: 7, font, color: MUTED },
  );
}

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
    row.target === null ? "N/A" : number(row.target),
    number(row.approved),
    row.difference === null
      ? "N/A"
      : row.difference === 0
        ? "0"
        : `${row.difference > 0 ? "+" : "-"}${number(Math.abs(row.difference))}`,
    percent(row.achievement),
    STATUS_LABEL[row.status],
    periodLabel,
    row.updatedAt ? formatDateId(row.updatedAt) : "-",
  ];

  let x = MARGIN + 3;
  values.forEach((value, index) => {
    const column = COLUMNS[index]!;
    const text = fit(font, value, 6.5, column.width - 8);
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
  doc.setTitle(safe(`Laporan Kinerja ${filters.period.label}`));
  doc.setAuthor("DAKOSTA");
  doc.setSubject("Laporan kinerja per instansi");
  doc.setCreator("DAKOSTA");
  doc.setProducer("DAKOSTA");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawPageBand(page);
  page.drawText("DAKOSTA", {
    x: MARGIN,
    y: PAGE_HEIGHT - 30,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Laporan Kinerja per Instansi", {
    x: MARGIN,
    y: PAGE_HEIGHT - 50,
    size: 17,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(safe(`Periode ${filters.period.label}`), {
    x: MARGIN,
    y: PAGE_HEIGHT - 65,
    size: 8.5,
    font,
    color: rgb(0.9, 0.97, 0.93),
  });

  let y = PAGE_HEIGHT - HEADER_HEIGHT - 18;
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
    ["Institusi", number(summary.institutions)],
    [
      "Target terisi",
      `${number(summary.withTarget)} / ${number(summary.institutions)}`,
    ],
    ["Realisasi approved", number(summary.approved)],
    ["Capaian agregat", percent(summary.achievement)],
    [
      "Target tercapai",
      `${number(summary.met)} / ${number(summary.withTarget)}`,
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
    if (y - ROW_HEIGHT < 34) {
      current = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawPageBand(current);
      current.drawText("Laporan Kinerja per Instansi (lanjutan)", {
        x: MARGIN,
        y: PAGE_HEIGHT - 28,
        size: 9,
        font: bold,
        color: rgb(1, 1, 1),
      });
      current.drawText(safe(`Periode ${filters.period.label}`), {
        x: MARGIN,
        y: PAGE_HEIGHT - 42,
        size: 7.5,
        font,
        color: rgb(0.9, 0.97, 0.93),
      });
      y = PAGE_HEIGHT - HEADER_HEIGHT - 12;
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
  if (y < 54) {
    current = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawPageBand(current);
    y = PAGE_HEIGHT - HEADER_HEIGHT - 20;
  }
  current.drawText(
    safe(
      "Realisasi = COUNT(DISTINCT konten) berstatus approved berdasarkan tanggal approval final dalam periode. Target per instansi = penjumlahan target bulanan; target kosong ditampilkan N/A, bukan 0.",
    ),
    { x: MARGIN, y, size: 6.8, font, color: MUTED },
  );

  const pages = doc.getPages();
  pages.forEach((item, index) => {
    drawFooter(item, font, index + 1, pages.length, filters.period.label);
  });

  return doc.save();
}
