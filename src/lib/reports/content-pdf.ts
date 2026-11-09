import "server-only";

import { PDFDocument, type PDFPage } from "pdf-lib";

import {
  ANALYTICS_TABLE_MAX_PAGE_SIZE,
  type AnalyticsContentRow,
} from "@/lib/analytics/content-table";
import type { AppRole } from "@/lib/authz/types";
import { PLATFORM_LABEL, STATUS_LABEL } from "@/lib/content-status";
import { formatDateId, formatDateTimeId } from "@/lib/dates";
import type { KontenFilters } from "@/lib/filters/konten";
import { absoluteContentUrl } from "@/lib/reports/content-links";
import {
  CONTENT_TYPE_LABELS,
  MAIN_THEME_LABELS,
  SUB_THEME_LABELS,
  type ContentType,
  type MainTheme,
  type SubTheme,
} from "@/lib/taxonomy";
import {
  REPORT_COLORS,
  REPORT_CONTENT_WIDTH,
  REPORT_PAGE,
  addUriAnnotation,
  drawReportFooter,
  drawReportHeader,
  fitText,
  formatNumber,
  loadBrandLogo,
  loadReportFonts,
  safe,
  setReportMetadata,
  wrapText,
  type ReportFonts,
} from "@/lib/reports/pdf-kit";

const MAX_ROWS = ANALYTICS_TABLE_MAX_PAGE_SIZE;

export const CONTENT_REPORT_ROW_CAP = MAX_ROWS;

const COLUMNS: Array<{
  label: string;
  width: number;
  wrap?: boolean;
}> = [
  { label: "Kode", width: 56 },
  { label: "Judul", width: 150, wrap: true },
  { label: "Instansi", width: 112, wrap: true },
  { label: "Tema / sub-tema", width: 88, wrap: true },
  { label: "Jenis", width: 52 },
  { label: "Platform", width: 58 },
  { label: "Status", width: 58 },
  { label: "Dibuat", width: 46 },
  { label: "Disetujui", width: 46 },
  { label: "Tautan", width: 104 },
];

const LINK_COLUMN_INDEX = COLUMNS.length - 1;

const TABLE_HEADER_HEIGHT = 20;
const LINE_HEIGHT = 9;
const ROW_PADDING = 6;
const BOTTOM_LIMIT = 44;

function cellValues(row: AnalyticsContentRow): string[] {
  return [
    row.referenceCode,
    row.title ?? "(tanpa judul)",
    row.branchName
      ? `${row.organization} · ${row.branchName}`
      : row.organization,
    `${
      row.mainTheme
        ? (MAIN_THEME_LABELS[row.mainTheme as MainTheme] ?? row.mainTheme)
        : "-"
    } / ${
      row.subTheme
        ? (SUB_THEME_LABELS[row.subTheme as SubTheme] ?? row.subTheme)
        : "Tanpa sub-tema"
    }`,
    row.contentType
      ? (CONTENT_TYPE_LABELS[row.contentType as ContentType] ?? row.contentType)
      : "Belum ditentukan",
    row.platform ? (PLATFORM_LABEL[row.platform] ?? row.platform) : "-",
    STATUS_LABEL[row.status] ?? row.status,
    formatDateId(row.dateCreated),
    row.approvedAt ? formatDateId(row.approvedAt) : "-",
    "Buka konten",
  ];
}

function filterSummary(filters: KontenFilters): string {
  const parts: string[] = [
    filters.mode === "approved" ? "Hanya disetujui" : "Semua status",
  ];
  if (filters.status !== "ALL" && filters.mode !== "approved") {
    parts.push(STATUS_LABEL[filters.status]);
  }
  if (filters.mainTheme) {
    parts.push(MAIN_THEME_LABELS[filters.mainTheme]);
  }
  if (filters.subTheme) {
    parts.push(SUB_THEME_LABELS[filters.subTheme]);
  }
  if (filters.contentType) {
    parts.push(CONTENT_TYPE_LABELS[filters.contentType] ?? filters.contentType);
  }
  if (filters.platform) {
    parts.push(PLATFORM_LABEL[filters.platform] ?? filters.platform);
  }
  if (filters.search) parts.push(`pencarian "${filters.search}"`);
  if (filters.dateFrom || filters.dateTo) {
    parts.push(
      `tanggal ${filters.dateFrom ?? "awal"} s.d. ${filters.dateTo ?? "akhir"}`,
    );
  }
  return parts.join(" · ");
}

function drawTableHeader(page: PDFPage, fonts: ReportFonts, top: number): void {
  const y = top - TABLE_HEADER_HEIGHT;
  page.drawRectangle({
    x: REPORT_PAGE.margin,
    y,
    width: REPORT_CONTENT_WIDTH,
    height: TABLE_HEADER_HEIGHT - 3,
    color: REPORT_COLORS.surface,
  });
  let x = REPORT_PAGE.margin + 3;
  for (const column of COLUMNS) {
    page.drawText(fitText(fonts.bold, column.label, 7, column.width - 6), {
      x,
      y: y + 4,
      size: 7,
      font: fonts.bold,
      color: REPORT_COLORS.muted,
    });
    x += column.width;
  }
  page.drawLine({
    start: { x: REPORT_PAGE.margin, y: y - 1 },
    end: {
      x: REPORT_PAGE.margin + REPORT_CONTENT_WIDTH,
      y: y - 1,
    },
    thickness: 0.5,
    color: REPORT_COLORS.line,
  });
}

function drawRow(
  page: PDFPage,
  fonts: ReportFonts,
  row: AnalyticsContentRow,
  top: number,
  role: AppRole,
): number {
  const url = absoluteContentUrl({
    role,
    id: row.id,
    publishedUrl: row.publishedUrl,
  });
  const values = cellValues(row);
  const cells = values.map((value, index) => {
    const column = COLUMNS[index]!;
    return column.wrap
      ? wrapText(fonts.font, value, 7, column.width - 6)
      : [fitText(fonts.font, value, 7, column.width - 6)];
  });
  const lineCount = Math.max(...cells.map((lines) => lines.length));
  const rowHeight = lineCount * LINE_HEIGHT + ROW_PADDING;
  let x = REPORT_PAGE.margin + 3;
  cells.forEach((lines, index) => {
    const column = COLUMNS[index]!;
    const isLink = index === LINK_COLUMN_INDEX;
    lines.forEach((line, lineIndex) => {
      const y = top - 10 - lineIndex * LINE_HEIGHT;
      page.drawText(line, {
        x,
        y,
        size: 7,
        font: isLink ? fonts.bold : fonts.font,
        color: isLink ? REPORT_COLORS.brand : REPORT_COLORS.ink,
      });
      if (isLink && lineIndex === 0) {
        page.drawLine({
          start: { x, y: y - 1.5 },
          end: { x: x + fonts.bold.widthOfTextAtSize(line, 7), y: y - 1.5 },
          thickness: 0.4,
          color: REPORT_COLORS.brand,
        });
        addUriAnnotation(
          page,
          {
            x: x - 1,
            y: top - rowHeight + 1,
            width: column.width - 4,
            height: rowHeight - 2,
          },
          url,
        );
      }
    });
    x += column.width;
  });
  page.drawLine({
    start: { x: REPORT_PAGE.margin, y: top - rowHeight + 1 },
    end: {
      x: REPORT_PAGE.margin + REPORT_CONTENT_WIDTH,
      y: top - rowHeight + 1,
    },
    thickness: 0.3,
    color: REPORT_COLORS.line,
  });
  return top - rowHeight;
}

export async function renderContentReportPdf(input: {
  scopeLabel: string;
  roleLabel: string;
  role: AppRole;
  filters: KontenFilters;
  rows: AnalyticsContentRow[];
  total: number;
  generatedAt: Date;
}): Promise<Uint8Array> {
  const { filters, rows, total } = input;
  const reportTitle =
    filters.mode === "approved"
      ? "Laporan Detail Konten Disetujui"
      : "Laporan Detail Konten";
  const doc = await PDFDocument.create();
  setReportMetadata(doc, {
    title: reportTitle,
    subject: "Detail konten DAKOSTA mengikuti filter aktif",
  });
  const fonts = await loadReportFonts(doc);
  const logo = await loadBrandLogo(doc);

  const truncated = total > rows.length;
  const footerMeta = `${reportTitle} - ${input.scopeLabel} - ${formatNumber(
    rows.length,
  )} baris`;

  let page = doc.addPage([REPORT_PAGE.width, REPORT_PAGE.height]);
  let y = drawReportHeader(page, fonts, logo, {
    title: reportTitle,
    subtitle: `${input.scopeLabel} - ${input.roleLabel}`,
  });
  y -= 16;
  page.drawText(
    fitText(
      fonts.font,
      `Dibuat ${formatDateTimeId(input.generatedAt)} WIB - ${formatNumber(
        total,
      )} konten sesuai filter - ${filterSummary(filters)}`,
      8,
      REPORT_CONTENT_WIDTH,
    ),
    {
      x: REPORT_PAGE.margin,
      y,
      size: 8,
      font: fonts.font,
      color: REPORT_COLORS.muted,
    },
  );
  y -= 18;
  drawTableHeader(page, fonts, y);
  y -= TABLE_HEADER_HEIGHT;

  if (rows.length === 0) {
    page.drawText("Tidak ada konten yang cocok dengan filter aktif.", {
      x: REPORT_PAGE.margin,
      y: y - 14,
      size: 8,
      font: fonts.font,
      color: REPORT_COLORS.muted,
    });
    y -= 30;
  }

  for (const row of rows) {
    const estimated = ROW_PADDING + LINE_HEIGHT * 3;
    if (y - estimated < BOTTOM_LIMIT) {
      page = doc.addPage([REPORT_PAGE.width, REPORT_PAGE.height]);
      y = drawReportHeader(page, fonts, logo, {
        title: `${reportTitle} (lanjutan)`,
        subtitle: `${input.scopeLabel} - ${input.roleLabel}`,
      });
      y -= 12;
      drawTableHeader(page, fonts, y);
      y -= TABLE_HEADER_HEIGHT;
    }
    y = drawRow(page, fonts, row, y, input.role);
  }

  if (y < BOTTOM_LIMIT + 24) {
    page = doc.addPage([REPORT_PAGE.width, REPORT_PAGE.height]);
    y = drawReportHeader(page, fonts, logo, {
      title: `${reportTitle} (catatan)`,
      subtitle: input.scopeLabel,
    });
    y -= 12;
  }

  y -= 10;
  page.drawText(
    safe(
      truncated
        ? `Laporan dipotong pada ${formatNumber(
            rows.length,
          )} baris dari ${formatNumber(
            total,
          )} hasil filter. Persempit filter untuk laporan lengkap.`
        : `Realisasi capaian hanya menghitung konten berstatus Disetujui dengan approved_at terisi dan tidak diarsipkan. Laporan memuat seluruh hasil filter, bukan hanya satu halaman.`,
    ),
    {
      x: REPORT_PAGE.margin,
      y,
      size: 7,
      font: fonts.font,
      color: REPORT_COLORS.muted,
    },
  );

  const pages = doc.getPages();
  pages.forEach((item, index) => {
    drawReportFooter(item, fonts, logo, {
      pageNumber: index + 1,
      totalPages: pages.length,
      metadata: footerMeta,
    });
  });

  return doc.save();
}
