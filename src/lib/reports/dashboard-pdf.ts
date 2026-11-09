import "server-only";

import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

import type { AppRole } from "@/lib/authz/types";
import { themeMapColor } from "@/lib/chart-theme";
import {
  DASHBOARD_CATEGORIES,
  DASHBOARD_CATEGORY_LABELS,
  type DashboardCategory,
  type DashboardCategoryTotals,
  type DashboardFiltered,
  type DashboardRankingRow,
  type DashboardSummary,
  type DashboardThemeRow,
} from "@/lib/dashboard/types";
import { rankingShare } from "@/lib/dashboard/ranking";
import {
  dashboardVariant,
  type DashboardVariant,
} from "@/lib/dashboard/variant";
import { formatDateTimeId, jakartaToday } from "@/lib/dates";
import type { BranchSelection } from "@/lib/filters/branch-selection";
import {
  REPORT_COLORS,
  REPORT_PAGE,
  drawLogo,
  fitText,
  formatNumber,
  loadBrandLogo,
  loadReportFonts,
  safe,
  setReportMetadata,
  wrapText,
  type ReportFonts,
} from "@/lib/reports/pdf-kit";

const PAGE_W = REPORT_PAGE.width;
const PAGE_H = REPORT_PAGE.height;
const MARGIN = 24;
const CONTENT_RIGHT = PAGE_W - MARGIN;
const CONTENT_W = CONTENT_RIGHT - MARGIN;
const HEADER_H = 46;
const FOOTER_LINE_Y = 30;

const KPI_HEIGHT = 40;
const MID_HEIGHT = 272;
const THEME_HEIGHT = 138;
const COLUMN_GAP = 12;
const CHART_COLUMN_WIDTH = 392;
const RANKING_COLUMN_X = MARGIN + CHART_COLUMN_WIDTH + COLUMN_GAP;
const RANKING_COLUMN_WIDTH = CONTENT_RIGHT - RANKING_COLUMN_X;

const BRANCH_MAX_ROWS = 16;
const BRANCH_KEEP_ROWS = 15;
const INSTITUTION_MAX_ROWS = 12;
const RANKING_ROWS = 8;
const THEME_LEGEND_MAX = 10;
const STAKEHOLDER_THEME_MAX = 16;
const THEME_LEGEND_COLUMNS = 2;
const BRAND_HEX = "#006b3c";

const percentFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
});

const RANKING_GRID: ReadonlyArray<
  readonly [DashboardCategory, DashboardCategory]
> = [
  ["FKRTL", "FKTP"],
  ["PEMDA", "STAKEHOLDER"],
];

export type DashboardPdfInput = {
  role: AppRole;
  scopeLabel: string;
  roleLabel: string;
  selection: BranchSelection;
  summary: DashboardSummary;
  filtered: DashboardFiltered;
  generatedAt: Date;
};

export type DashboardChartPlanRow = {
  id: string;
  name: string;
  categories: DashboardCategoryTotals;
  total: number;
  aggregated: boolean;
};

export type DashboardPdfPlan = {
  variant: DashboardVariant;
  chartTitle: string;
  chartRows: DashboardChartPlanRow[];
  chartCount: number;
  aggregatedCount: number;
  rankings: Record<DashboardCategory, DashboardRankingRow[]>;
  themes: DashboardThemeRow[];
  themeLegend: DashboardThemeRow[];
  hiddenThemes: number;
  selectionLabel: string;
};

export function dashboardExportFilename(
  role: AppRole,
  date: Date = new Date(),
): string {
  return `dashboard-dakosta-${role.toLowerCase()}-${jakartaToday(date)}.pdf`;
}

function emptyCategories(): DashboardCategoryTotals {
  return { FKRTL: 0, FKTP: 0, PEMDA: 0, STAKEHOLDER: 0 };
}

function selectionLabel(selection: BranchSelection): string {
  switch (selection.mode) {
    case "all":
      return "Semua cabang";
    case "none":
      return "Tidak ada cabang dipilih";
    case "subset":
      return `${formatNumber(selection.ids.length)} cabang terpilih`;
    case "not-applicable":
      return "Seluruh data dalam cakupan";
  }
}

function sumCategories(
  rows: ReadonlyArray<{ categories: DashboardCategoryTotals }>,
): DashboardCategoryTotals {
  const categories = emptyCategories();
  for (const row of rows) {
    for (const category of DASHBOARD_CATEGORIES) {
      categories[category] += row.categories[category];
    }
  }
  return categories;
}

/**
 * Pure single-page plan. Named bars beyond the row budget collapse into one
 * aggregate row so every rendered total still reconciles with the data.
 */
export function planDashboardPage(input: DashboardPdfInput): DashboardPdfPlan {
  const variant = dashboardVariant(input.role);
  const chartRows: DashboardChartPlanRow[] = [];
  let chartCount = 0;
  let aggregatedCount = 0;

  if (variant === "branch") {
    const chart = input.filtered.institutionChart;
    chartCount = chart.total;
    for (const row of chart.rows.slice(0, INSTITUTION_MAX_ROWS)) {
      chartRows.push({
        id: row.id,
        name: row.name,
        categories: row.categories,
        total: row.total,
        aggregated: false,
      });
    }
    // Fold anything beyond the PDF row budget into the aggregate row so the
    // panel total always reconciles with the chart total.
    const overflow = chart.rows.slice(INSTITUTION_MAX_ROWS);
    const overflowCategories = sumCategories(overflow);
    const remaining = chart.remaining;
    const aggregateCount = (remaining?.count ?? 0) + overflow.length;
    if (remaining || overflow.length > 0) {
      const categories = remaining
        ? {
            FKRTL: remaining.categories.FKRTL + overflowCategories.FKRTL,
            FKTP: remaining.categories.FKTP + overflowCategories.FKTP,
            PEMDA: remaining.categories.PEMDA + overflowCategories.PEMDA,
            STAKEHOLDER:
              remaining.categories.STAKEHOLDER + overflowCategories.STAKEHOLDER,
          }
        : overflowCategories;
      const aggregateTotal =
        (remaining?.total ?? 0) +
        overflow.reduce((sum, row) => sum + row.total, 0);
      aggregatedCount = aggregateCount;
      chartRows.push({
        id: "__aggregate__",
        name: `Institusi lainnya (${formatNumber(aggregateCount)})`,
        categories,
        total: aggregateTotal,
        aggregated: true,
      });
    }
  } else if (variant !== "stakeholder") {
    const sorted = [...input.summary.branches].sort(
      (left, right) =>
        right.total - left.total || left.name.localeCompare(right.name),
    );
    chartCount = sorted.length;
    if (sorted.length <= BRANCH_MAX_ROWS) {
      for (const branch of sorted) {
        chartRows.push({
          id: branch.id,
          name: branch.name,
          categories: branch.categories,
          total: branch.total,
          aggregated: false,
        });
      }
    } else {
      for (const branch of sorted.slice(0, BRANCH_KEEP_ROWS)) {
        chartRows.push({
          id: branch.id,
          name: branch.name,
          categories: branch.categories,
          total: branch.total,
          aggregated: false,
        });
      }
      const hidden = sorted.slice(BRANCH_KEEP_ROWS);
      aggregatedCount = hidden.length;
      chartRows.push({
        id: "__aggregate__",
        name: `Cabang lainnya (${formatNumber(hidden.length)})`,
        categories: sumCategories(hidden),
        total: hidden.reduce((total, branch) => total + branch.total, 0),
        aggregated: true,
      });
    }
  }

  const rankings = {} as Record<DashboardCategory, DashboardRankingRow[]>;
  for (const category of DASHBOARD_CATEGORIES) {
    rankings[category] =
      variant === "stakeholder"
        ? []
        : (input.filtered.rankings[category] ?? []).slice(0, RANKING_ROWS);
  }

  const themes = input.filtered.nonEdufastThemes;
  const legendMax =
    variant === "stakeholder" ? STAKEHOLDER_THEME_MAX : THEME_LEGEND_MAX;
  return {
    variant,
    chartTitle:
      variant === "branch"
        ? "Konten per Institusi"
        : variant === "stakeholder"
          ? ""
          : "Konten per Cabang",
    chartRows,
    chartCount,
    aggregatedCount,
    rankings,
    themes,
    themeLegend: themes.slice(0, legendMax),
    hiddenThemes: Math.max(0, themes.length - legendMax),
    selectionLabel: selectionLabel(input.selection),
  };
}

function hexRgb(hex: string): ReturnType<typeof rgb> {
  const clean = hex.replace("#", "");
  return rgb(
    Number.parseInt(clean.slice(0, 2), 16) / 255,
    Number.parseInt(clean.slice(2, 4), 16) / 255,
    Number.parseInt(clean.slice(4, 6), 16) / 255,
  );
}

function drawRightText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  size: number,
  right: number,
  y: number,
  color = REPORT_COLORS.ink,
): void {
  const text = safe(value);
  page.drawText(text, {
    x: right - font.widthOfTextAtSize(text, size),
    y,
    size,
    font,
    color,
  });
}

function drawHeader(
  page: PDFPage,
  fonts: ReportFonts,
  logo: PDFImage | null,
  input: { title: string; subtitle: string },
): number {
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 4,
    width: PAGE_W,
    height: 4,
    color: REPORT_COLORS.brand,
  });
  page.drawText(fitText(fonts.bold, input.title, 13.5, 520), {
    x: MARGIN,
    y: PAGE_H - 25,
    size: 13.5,
    font: fonts.bold,
    color: REPORT_COLORS.ink,
  });
  page.drawText(fitText(fonts.font, input.subtitle, 7, 690), {
    x: MARGIN,
    y: PAGE_H - 37,
    size: 7,
    font: fonts.font,
    color: REPORT_COLORS.muted,
  });
  if (logo) {
    drawLogo(page, logo, {
      x: CONTENT_RIGHT - 60,
      y: PAGE_H - 41,
      height: 20,
    });
  }
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - HEADER_H },
    end: { x: CONTENT_RIGHT, y: PAGE_H - HEADER_H },
    thickness: 0.6,
    color: REPORT_COLORS.line,
  });
  return PAGE_H - HEADER_H;
}

function drawFooter(
  page: PDFPage,
  fonts: ReportFonts,
  logo: PDFImage | null,
  input: { scopeLabel: string; generatedAt: Date },
): void {
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_LINE_Y },
    end: { x: CONTENT_RIGHT, y: FOOTER_LINE_Y },
    thickness: 0.5,
    color: REPORT_COLORS.line,
  });
  page.drawText(
    fitText(
      fonts.font,
      `DAKOSTA - Dashboard - ${input.scopeLabel}`,
      7,
      CONTENT_W - 180,
    ),
    {
      x: MARGIN,
      y: 17,
      size: 7,
      font: fonts.font,
      color: REPORT_COLORS.muted,
    },
  );
  drawRightText(
    page,
    fonts.font,
    `Dibuat ${formatDateTimeId(input.generatedAt)} WIB`,
    6.6,
    CONTENT_RIGHT - 60,
    17,
    REPORT_COLORS.muted,
  );
  if (logo) {
    drawLogo(page, logo, {
      x: CONTENT_RIGHT - 54,
      y: 13,
      height: 11,
    });
  }
}

function drawKpiCard(
  page: PDFPage,
  fonts: ReportFonts,
  input: { x: number; y: number; width: number; label: string; value: string },
): void {
  page.drawRectangle({
    x: input.x,
    y: input.y,
    width: input.width,
    height: KPI_HEIGHT,
    color: REPORT_COLORS.surface,
    borderColor: REPORT_COLORS.line,
    borderWidth: 0.5,
  });
  page.drawText(fitText(fonts.font, input.label, 6, input.width - 12), {
    x: input.x + 6,
    y: input.y + 25,
    size: 6,
    font: fonts.font,
    color: REPORT_COLORS.muted,
  });
  page.drawText(fitText(fonts.bold, input.value, 12, input.width - 12), {
    x: input.x + 6,
    y: input.y + 8,
    size: 12,
    font: fonts.bold,
    color: REPORT_COLORS.ink,
  });
}

/**
 * Horizontal single-series bar chart: one brand colour, four value ticks, and
 * value labels in a fixed right column so no label can clip the page edge.
 */
function drawBarChart(
  page: PDFPage,
  fonts: ReportFonts,
  plan: DashboardPdfPlan,
  input: { x: number; top: number; width: number; height: number },
): void {
  page.drawRectangle({
    x: input.x,
    y: input.top - input.height,
    width: input.width,
    height: input.height,
    color: REPORT_COLORS.white,
    borderColor: REPORT_COLORS.line,
    borderWidth: 0.6,
  });
  page.drawText(plan.chartTitle, {
    x: input.x + 10,
    y: input.top - 14,
    size: 9.5,
    font: fonts.bold,
    color: REPORT_COLORS.ink,
  });
  page.drawText(
    fitText(
      fonts.font,
      `${formatNumber(plan.chartRows.reduce((total, row) => total + row.total, 0))} konten tervalidasi`,
      6,
      input.width - 140,
    ),
    {
      x: input.x + 10,
      y: input.top - 24,
      size: 6,
      font: fonts.font,
      color: REPORT_COLORS.muted,
    },
  );

  if (plan.chartRows.length === 0) {
    page.drawText(
      plan.variant === "branch"
        ? "Belum ada institusi dengan konten tervalidasi."
        : "Belum ada cabang dalam cakupan untuk ditampilkan.",
      {
        x: input.x + 10,
        y: input.top - 58,
        size: 8,
        font: fonts.font,
        color: REPORT_COLORS.muted,
      },
    );
    return;
  }

  const labelWidth = 132;
  const barsX = input.x + 10 + labelWidth + 6;
  const totalRight = input.x + input.width - 10;
  const barsWidth = totalRight - 38 - barsX;
  const gridTop = input.top - 36;
  const gridBottom = input.top - input.height + 8;
  const gridHeight = gridTop - gridBottom;
  // Cap the pitch on sparse scopes (four national branches) so the fixed
  // one-page band does not stretch a handful of bars across 270pt.
  const rowHeight = Math.min(28, gridHeight / plan.chartRows.length);
  const rowsTop =
    gridTop - Math.max(0, (gridHeight - rowHeight * plan.chartRows.length) / 2);
  const maxTotal = Math.max(
    ...plan.chartRows.filter((row) => !row.aggregated).map((row) => row.total),
    1,
  );
  const tickStep = Math.max(1, Math.ceil(maxTotal / 4));
  const scaleMax = tickStep * 4;
  const barHeight = Math.min(10, Math.max(5, rowHeight * 0.45));

  for (let tick = 0; tick <= 4; tick += 1) {
    const ratio = tick / 4;
    const x = barsX + barsWidth * ratio;
    page.drawLine({
      start: { x, y: gridBottom },
      end: { x, y: gridTop },
      thickness: 0.3,
      color: REPORT_COLORS.line,
    });
    const label = formatNumber(tick * tickStep);
    page.drawText(label, {
      x: x - fonts.font.widthOfTextAtSize(label, 5.2) / 2,
      y: gridTop + 4,
      size: 5.2,
      font: fonts.font,
      color: REPORT_COLORS.muted,
    });
  }

  plan.chartRows.forEach((row, index) => {
    const center = rowsTop - (index + 0.5) * rowHeight;
    const labelColor = row.aggregated ? REPORT_COLORS.muted : REPORT_COLORS.ink;
    page.drawText(fitText(fonts.bold, row.name, 6.4, labelWidth), {
      x: input.x + 10,
      y: center - 2.2,
      size: 6.4,
      font: fonts.bold,
      color: labelColor,
    });

    // The aggregate row sums every hidden row; drawing it to the same scale
    // would flatten all named bars, so only its value is printed.
    if (!row.aggregated) {
      const width = Math.max(
        (row.total / scaleMax) * barsWidth,
        row.total > 0 ? 1.2 : 0,
      );
      page.drawRectangle({
        x: barsX,
        y: center - barHeight / 2,
        width,
        height: barHeight,
        color: REPORT_COLORS.brand,
      });
    }
    drawRightText(
      page,
      fonts.bold,
      formatNumber(row.total),
      6.6,
      totalRight,
      center - 2.2,
    );
  });
}

function drawRankingPanel(
  page: PDFPage,
  fonts: ReportFonts,
  input: {
    x: number;
    top: number;
    width: number;
    height: number;
    category: DashboardCategory;
    score: number;
    rows: DashboardRankingRow[];
  },
): void {
  const color = hexRgb(BRAND_HEX);
  const label = DASHBOARD_CATEGORY_LABELS[input.category];

  page.drawRectangle({
    x: input.x,
    y: input.top - input.height,
    width: input.width,
    height: input.height,
    color: REPORT_COLORS.white,
    borderColor: REPORT_COLORS.line,
    borderWidth: 0.6,
  });
  page.drawRectangle({
    x: input.x,
    y: input.top - 2.5,
    width: input.width,
    height: 2.5,
    color,
  });

  page.drawText(`Konten ${safe(label)}`, {
    x: input.x + 8,
    y: input.top - 14,
    size: 7.6,
    font: fonts.bold,
    color: REPORT_COLORS.muted,
  });
  drawRightText(
    page,
    fonts.bold,
    formatNumber(input.score),
    9.5,
    input.x + input.width - 8,
    input.top - 15,
  );

  if (input.rows.length === 0) {
    page.drawText("Belum ada konten tervalidasi.", {
      x: input.x + 8,
      y: input.top - 46,
      size: 6.4,
      font: fonts.font,
      color: REPORT_COLORS.muted,
    });
    return;
  }

  const trackX = input.x + 8;
  const trackWidth = input.width - 16;
  const rowsTop = input.top - 26;
  const available = rowsTop - (input.top - input.height) - 6;
  const rowHeight = Math.min(13, available / input.rows.length);

  input.rows.forEach((row, index) => {
    const rowTop = rowsTop - index * rowHeight;
    const share = rankingShare(row.total, input.score);
    page.drawText(`${index + 1}`, {
      x: trackX,
      y: rowTop - 5.6,
      size: 5.4,
      font: fonts.bold,
      color: REPORT_COLORS.muted,
    });
    page.drawText(fitText(fonts.bold, row.name, 6.2, trackWidth - 52), {
      x: trackX + 12,
      y: rowTop - 5.6,
      size: 6.2,
      font: fonts.bold,
      color: REPORT_COLORS.ink,
    });
    drawRightText(
      page,
      fonts.bold,
      formatNumber(row.total),
      6.2,
      trackX + trackWidth,
      rowTop - 5.6,
    );
    page.drawRectangle({
      x: trackX + 12,
      y: rowTop - 9.6,
      width: Math.max(0, trackWidth - 12),
      height: 2.2,
      color: REPORT_COLORS.surface,
    });
    page.drawRectangle({
      x: trackX + 12,
      y: rowTop - 9.6,
      width: Math.max(
        ((trackWidth - 12) * share) / 100,
        row.total > 0 ? 1.2 : 0,
      ),
      height: 2.2,
      color,
    });
  });
}

function svgY(y: number): number {
  return PAGE_H - y;
}

function drawPieSlice(
  page: PDFPage,
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
  color: ReturnType<typeof rgb>,
): void {
  const steps = Math.max(2, Math.ceil(Math.abs(endDeg - startDeg) / 2));
  const points = [`M ${cx} ${svgY(cy)}`];
  for (let step = 0; step <= steps; step += 1) {
    const angle =
      ((startDeg + ((endDeg - startDeg) * step) / steps) * Math.PI) / 180;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    points.push(`L ${x} ${svgY(y)}`);
  }
  points.push("Z");
  page.drawSvgPath(points.join(" "), { x: 0, y: PAGE_H, color });
}

function drawDonut(
  page: PDFPage,
  fonts: ReportFonts,
  input: {
    cx: number;
    cy: number;
    outer: number;
    inner: number;
    total: number;
    themes: DashboardThemeRow[];
  },
): void {
  let angle = 90;
  input.themes.forEach((theme, index) => {
    const sweep = (theme.total / input.total) * 360;
    const end = angle - sweep;
    drawPieSlice(
      page,
      input.cx,
      input.cy,
      input.outer,
      angle,
      end,
      hexRgb(themeMapColor(theme.key, index)),
    );
    angle = end;
  });

  page.drawCircle({
    x: input.cx,
    y: input.cy,
    size: input.inner,
    color: REPORT_COLORS.white,
    borderColor: REPORT_COLORS.line,
    borderWidth: 0.5,
  });
  const value = formatNumber(input.total);
  page.drawText(value, {
    x: input.cx - fonts.bold.widthOfTextAtSize(value, 12) / 2,
    y: input.cy - 1,
    size: 12,
    font: fonts.bold,
    color: REPORT_COLORS.ink,
  });
  const caption = "konten";
  page.drawText(caption, {
    x: input.cx - fonts.font.widthOfTextAtSize(caption, 5.8) / 2,
    y: input.cy - 10,
    size: 5.8,
    font: fonts.font,
    color: REPORT_COLORS.muted,
  });
}

function drawThemeLegend(
  page: PDFPage,
  fonts: ReportFonts,
  rows: DashboardThemeRow[],
  input: { x: number; y: number; width: number; rowHeight: number },
): void {
  const columnWidth =
    (input.width - (THEME_LEGEND_COLUMNS - 1) * 14) / THEME_LEGEND_COLUMNS;
  const rowsPerColumn = Math.ceil(rows.length / THEME_LEGEND_COLUMNS);
  rows.forEach((row, index) => {
    const column = Math.floor(index / rowsPerColumn);
    const line = index % rowsPerColumn;
    const x = input.x + column * (columnWidth + 14);
    const y = input.y - line * input.rowHeight;
    page.drawCircle({
      x: x + 2,
      y: y + 2.2,
      size: 2.2,
      color: hexRgb(themeMapColor(row.key, index)),
    });
    page.drawText(fitText(fonts.font, row.label, 6.2, columnWidth - 70), {
      x: x + 8,
      y,
      size: 6.2,
      font: fonts.font,
      color: REPORT_COLORS.ink,
    });
    drawRightText(
      page,
      fonts.bold,
      `${formatNumber(row.total)} (${percentFormatter.format(row.percentage)}%)`,
      6.2,
      x + columnWidth,
      y,
      REPORT_COLORS.ink,
    );
  });
}

function scopePhrase(variant: DashboardVariant): string {
  switch (variant) {
    case "branch":
      return "cakupan cabang Anda";
    case "stakeholder":
      return "organisasi Anda";
    default:
      return "cabang terpilih";
  }
}

function drawThemeBand(
  page: PDFPage,
  fonts: ReportFonts,
  input: DashboardPdfInput,
  plan: DashboardPdfPlan,
  band: { top: number; height: number },
): void {
  const bottom = band.top - band.height;
  page.drawRectangle({
    x: MARGIN,
    y: bottom,
    width: CONTENT_W,
    height: band.height,
    color: REPORT_COLORS.white,
    borderColor: REPORT_COLORS.line,
    borderWidth: 0.6,
  });
  page.drawText("Tema Konten", {
    x: MARGIN + 10,
    y: band.top - 13,
    size: 9.5,
    font: fonts.bold,
    color: REPORT_COLORS.ink,
  });
  page.drawText("EDUFAST dan sub-tema Non-EDUFAST", {
    x: MARGIN + 80,
    y: band.top - 12.5,
    size: 6.2,
    font: fonts.font,
    color: REPORT_COLORS.muted,
  });

  const cardWidth = 150;
  const cardX = MARGIN + 10;
  drawKpiCard(page, fonts, {
    x: cardX,
    y: band.top - 58,
    width: cardWidth,
    label: "Konten EDUFAST",
    value: formatNumber(input.filtered.edufast),
  });
  drawKpiCard(page, fonts, {
    x: cardX,
    y: band.top - 100,
    width: cardWidth,
    label: "Konten Non-EDUFAST",
    value: formatNumber(input.filtered.nonEdufast),
  });

  const donutCx = MARGIN + 280;
  const donutCy = bottom + band.height / 2 - 4;
  if (input.filtered.nonEdufastThemes.length === 0) {
    const lines = wrapText(
      fonts.font,
      `Belum ada konten Non-EDUFAST pada ${scopePhrase(plan.variant)}.`,
      6.6,
      150,
    );
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: donutCx - 70,
        y: donutCy + 12 - index * 9,
        size: 6.6,
        font: fonts.font,
        color: REPORT_COLORS.muted,
      });
    });
  } else {
    drawDonut(page, fonts, {
      cx: donutCx,
      cy: donutCy,
      outer: 46,
      inner: 28,
      total: Math.max(input.filtered.nonEdufast, 1),
      themes: input.filtered.nonEdufastThemes,
    });
  }

  const legendX = MARGIN + 380;
  drawThemeLegend(page, fonts, plan.themeLegend, {
    x: legendX,
    y: band.top - 30,
    width: CONTENT_RIGHT - 10 - legendX,
    rowHeight: 14,
  });
  if (plan.hiddenThemes > 0) {
    page.drawText(
      `+${formatNumber(plan.hiddenThemes)} tema lainnya (lihat dashboard)`,
      {
        x: legendX,
        y: bottom + 16,
        size: 5.8,
        font: fonts.font,
        color: REPORT_COLORS.muted,
      },
    );
  }

  if (input.filtered.unclassifiedTheme > 0) {
    page.drawText(
      `Termasuk ${formatNumber(input.filtered.unclassifiedTheme)} konten tanpa tema.`,
      {
        x: cardX,
        y: bottom + 8,
        size: 5.8,
        font: fonts.font,
        color: REPORT_COLORS.muted,
      },
    );
  }
}

/**
 * Stakeholder layout: the theme band owns the whole body, so the donut grows
 * and the legend gets one full-width column with proportional tracks.
 */
function drawStakeholderThemeBand(
  page: PDFPage,
  fonts: ReportFonts,
  input: DashboardPdfInput,
  plan: DashboardPdfPlan,
  band: { top: number; height: number },
): void {
  const bottom = band.top - band.height;
  page.drawRectangle({
    x: MARGIN,
    y: bottom,
    width: CONTENT_W,
    height: band.height,
    color: REPORT_COLORS.white,
    borderColor: REPORT_COLORS.line,
    borderWidth: 0.6,
  });
  page.drawText("Tema Konten", {
    x: MARGIN + 12,
    y: band.top - 17,
    size: 9.5,
    font: fonts.bold,
    color: REPORT_COLORS.ink,
  });
  page.drawText("EDUFAST dan sub-tema Non-EDUFAST pada organisasi Anda", {
    x: MARGIN + 82,
    y: band.top - 16.5,
    size: 6.4,
    font: fonts.font,
    color: REPORT_COLORS.muted,
  });

  const donutCx = MARGIN + 130;
  const donutCy = bottom + band.height / 2 - 8;
  if (input.filtered.nonEdufastThemes.length === 0) {
    const lines = wrapText(
      fonts.font,
      "Belum ada konten Non-EDUFAST pada organisasi Anda.",
      7,
      150,
    );
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: donutCx - 75,
        y: donutCy + 16 - index * 10,
        size: 7,
        font: fonts.font,
        color: REPORT_COLORS.muted,
      });
    });
  } else {
    drawDonut(page, fonts, {
      cx: donutCx,
      cy: donutCy,
      outer: 66,
      inner: 40,
      total: Math.max(input.filtered.nonEdufast, 1),
      themes: input.filtered.nonEdufastThemes,
    });
  }

  const legendX = MARGIN + 260;
  const legendWidth = CONTENT_RIGHT - 12 - legendX;
  const rowsTop = band.top - 46;
  const rowsBottom = bottom + 18;
  const available = rowsTop - rowsBottom;
  const rowHeight =
    plan.themeLegend.length > 0
      ? Math.min(22, (available - 8) / plan.themeLegend.length)
      : 0;

  if (plan.themeLegend.length === 0) {
    page.drawText("Belum ada tema Non-EDUFAST untuk ditampilkan.", {
      x: legendX,
      y: rowsTop - 6,
      size: 7,
      font: fonts.font,
      color: REPORT_COLORS.muted,
    });
  } else {
    const blockHeight = rowHeight * plan.themeLegend.length;
    const start =
      rowsTop - Math.max(0, (available - blockHeight) / 2) - rowHeight + 6;
    plan.themeLegend.forEach((row, index) => {
      const y = start - index * rowHeight;
      page.drawCircle({
        x: legendX + 2.5,
        y: y + 3,
        size: 2.6,
        color: hexRgb(themeMapColor(row.key, index)),
      });
      page.drawText(fitText(fonts.font, row.label, 6.8, legendWidth - 96), {
        x: legendX + 9,
        y,
        size: 6.8,
        font: fonts.font,
        color: REPORT_COLORS.ink,
      });
      drawRightText(
        page,
        fonts.bold,
        `${formatNumber(row.total)} (${percentFormatter.format(row.percentage)}%)`,
        6.8,
        legendX + legendWidth,
        y,
      );
      const trackY = y - 4.2;
      page.drawRectangle({
        x: legendX + 9,
        y: trackY,
        width: legendWidth - 9,
        height: 2.4,
        color: REPORT_COLORS.surface,
      });
      page.drawRectangle({
        x: legendX + 9,
        y: trackY,
        width: Math.max(
          ((legendWidth - 9) * row.percentage) / 100,
          row.total > 0 ? 1.2 : 0,
        ),
        height: 2.4,
        color: hexRgb(themeMapColor(row.key, index)),
      });
    });
  }

  if (plan.hiddenThemes > 0) {
    page.drawText(
      `+${formatNumber(plan.hiddenThemes)} tema lainnya (lihat dashboard)`,
      {
        x: legendX,
        y: bottom + 8,
        size: 6,
        font: fonts.font,
        color: REPORT_COLORS.muted,
      },
    );
  }
  if (input.filtered.unclassifiedTheme > 0) {
    page.drawText(
      `Termasuk ${formatNumber(input.filtered.unclassifiedTheme)} konten tanpa tema.`,
      {
        x: MARGIN + 12,
        y: bottom + 10,
        size: 6,
        font: fonts.font,
        color: REPORT_COLORS.muted,
      },
    );
  }
}

function kpiCards(
  input: DashboardPdfInput,
  plan: DashboardPdfPlan,
): Array<[string, string]> {
  const filterScoped =
    plan.variant !== "branch" &&
    plan.variant !== "stakeholder" &&
    (input.selection.mode === "subset" || input.selection.mode === "none");
  const suffix = filterScoped ? " (seluruh cakupan)" : "";
  const total: [string, string] = [
    `Total Konten Tervalidasi${suffix}`,
    formatNumber(input.summary.totalApproved),
  ];
  const scopeKpi: [string, string] =
    plan.variant === "branch" || plan.variant === "stakeholder"
      ? [
          "Institusi dengan Konten",
          formatNumber(input.filtered.map.totals.institutions),
        ]
      : [
          `Cabang dengan Konten${suffix}`,
          `${formatNumber(input.summary.branchesWithContent)} dari ${formatNumber(input.summary.branchCount)}`,
        ];

  if (plan.variant === "stakeholder") {
    return [
      total,
      scopeKpi,
      ["Konten EDUFAST", formatNumber(input.filtered.edufast)],
      ["Konten Non-EDUFAST", formatNumber(input.filtered.nonEdufast)],
    ];
  }

  return [
    total,
    scopeKpi,
    ["FKRTL", formatNumber(input.filtered.categoryTotals.FKRTL)],
    ["FKTP", formatNumber(input.filtered.categoryTotals.FKTP)],
    ["Pemda", formatNumber(input.filtered.categoryTotals.PEMDA)],
    ["Stakeholder", formatNumber(input.filtered.categoryTotals.STAKEHOLDER)],
  ];
}

export async function renderDashboardPdf(
  input: DashboardPdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadReportFonts(doc);
  const logo = await loadBrandLogo(doc);
  const plan = planDashboardPage(input);

  const unassigned =
    input.summary.unassignedApproved > 0
      ? ` - Termasuk ${formatNumber(input.summary.unassignedApproved)} konten tanpa cabang`
      : "";
  const subtitle = `Cakupan: ${input.scopeLabel} - Peran: ${input.roleLabel} - Filter cabang: ${plan.selectionLabel} - Dibuat: ${formatDateTimeId(input.generatedAt)} WIB${unassigned}`;

  setReportMetadata(doc, {
    title: "Dashboard DAKOSTA",
    subject: subtitle,
  });

  const page = doc.addPage([PAGE_W, PAGE_H]);
  const contentTop = drawHeader(page, fonts, logo, {
    title: "Dashboard DAKOSTA",
    subtitle,
  });

  const kpis = kpiCards(input, plan);
  const kpiTop = contentTop - 8;
  const kpiBottom = kpiTop - KPI_HEIGHT;
  const gap = 8;
  const cardWidth = (CONTENT_W - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach(([label, value], index) => {
    drawKpiCard(page, fonts, {
      x: MARGIN + index * (cardWidth + gap),
      y: kpiBottom,
      width: cardWidth,
      label,
      value,
    });
  });

  if (plan.variant === "stakeholder") {
    const top = kpiBottom - 16;
    drawStakeholderThemeBand(page, fonts, input, plan, {
      top,
      height: top - (FOOTER_LINE_Y + 10),
    });
  } else {
    const midTop = kpiBottom - 22;
    drawBarChart(page, fonts, plan, {
      x: MARGIN,
      top: midTop,
      width: CHART_COLUMN_WIDTH,
      height: MID_HEIGHT,
    });

    const panelGap = 9;
    const panelWidth = (RANKING_COLUMN_WIDTH - panelGap) / 2;
    const panelHeight = (MID_HEIGHT - panelGap) / 2;
    RANKING_GRID.forEach((row, rowIndex) => {
      row.forEach((category, columnIndex) => {
        drawRankingPanel(page, fonts, {
          x: RANKING_COLUMN_X + columnIndex * (panelWidth + panelGap),
          top: midTop - rowIndex * (panelHeight + panelGap),
          width: panelWidth,
          height: panelHeight,
          category,
          score: input.filtered.categoryTotals[category],
          rows: plan.rankings[category],
        });
      });
    });

    drawThemeBand(page, fonts, input, plan, {
      top: midTop - MID_HEIGHT - 8,
      height: THEME_HEIGHT,
    });
  }

  drawFooter(page, fonts, logo, {
    scopeLabel: input.scopeLabel,
    generatedAt: input.generatedAt,
  });

  return doc.save();
}
