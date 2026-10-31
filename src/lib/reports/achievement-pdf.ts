import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { AchievementReport } from "@/lib/reports/achievement";
import { formatDateId } from "@/lib/dates";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;

const GREEN = rgb(0, 0.42, 0.235);
const TEAL = rgb(0, 0.52, 0.486);
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

type Align = "left" | "right";

class ReportBuilder {
  private readonly doc: PDFDocument;
  private readonly font: PDFFont;
  private readonly bold: PDFFont;
  private page: PDFPage;
  private y: number;

  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont, page: PDFPage) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.page = page;
    this.y = A4_HEIGHT - MARGIN;
  }

  get currentY(): number {
    return this.y;
  }

  setCursor(y: number): void {
    this.y = y;
  }

  ensure(height: number): void {
    if (this.y - height < MARGIN + 28) this.newPage();
  }

  newPage(): void {
    this.page = this.doc.addPage([A4_WIDTH, A4_HEIGHT]);
    this.page.drawRectangle({
      x: 0,
      y: A4_HEIGHT - 4,
      width: A4_WIDTH,
      height: 4,
      color: GREEN,
    });
    this.y = A4_HEIGHT - MARGIN;
  }

  text(
    value: string,
    options: {
      x?: number;
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      align?: Align;
      width?: number;
      lineHeight?: number;
    } = {},
  ): void {
    const size = options.size ?? 10;
    const font = options.bold ? this.bold : this.font;
    const clean = safe(value);
    const width = options.width ?? CONTENT_WIDTH;
    const textWidth = font.widthOfTextAtSize(clean, size);
    const x =
      options.align === "right"
        ? (options.x ?? MARGIN) + width - textWidth
        : (options.x ?? MARGIN);
    this.ensure(size + 4);
    this.page.drawText(clean, {
      x,
      y: this.y - size,
      size,
      font,
      color: options.color ?? INK,
    });
    this.y -= options.lineHeight ?? size + 4;
  }

  gap(height = 8): void {
    this.y -= height;
  }

  rule(): void {
    this.ensure(8);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4_WIDTH - MARGIN, y: this.y },
      thickness: 0.6,
      color: LINE,
    });
    this.y -= 6;
  }

  section(title: string): void {
    this.ensure(34);
    this.gap(6);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 12,
      width: 4,
      height: 12,
      color: TEAL,
    });
    this.page.drawText(safe(title), {
      x: MARGIN + 10,
      y: this.y - 12,
      size: 11,
      font: this.bold,
      color: INK,
    });
    this.y -= 22;
  }

  table(
    columns: Array<{ label: string; width: number; align?: Align }>,
    rows: string[][],
  ): void {
    const drawHeader = () => {
      this.ensure(22);
      this.page.drawRectangle({
        x: MARGIN,
        y: this.y - 15,
        width: CONTENT_WIDTH,
        height: 15,
        color: SURFACE,
      });
      let x = MARGIN + 3;
      for (const column of columns) {
        const width = column.width;
        const textWidth = this.bold.widthOfTextAtSize(safe(column.label), 7.5);
        const textX =
          column.align === "right"
            ? x + width - textWidth - 4
            : x + 1;
        this.page.drawText(safe(column.label), {
          x: textX,
          y: this.y - 11,
          size: 7.5,
          font: this.bold,
          color: MUTED,
        });
        x += width;
      }
      this.y -= 17;
    };

    drawHeader();
    for (const row of rows) {
      if (this.y - 13 < MARGIN + 28) {
        this.newPage();
        drawHeader();
      }
      let x = MARGIN + 3;
      const size = 7.5;
      for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index]!;
        const raw = safe(row[index] ?? "");
        let value = raw;
        const maxWidth = column.width - 6;
        while (
          value.length > 1 &&
          this.font.widthOfTextAtSize(value, size) > maxWidth
        ) {
          value = `${value.slice(0, -2)}~`;
        }
        const textWidth = this.font.widthOfTextAtSize(value, size);
        const textX =
          column.align === "right" ? x + column.width - textWidth - 4 : x + 1;
        this.page.drawText(value, {
          x: textX,
          y: this.y - 9,
          size,
          font: this.font,
          color: INK,
        });
        x += column.width;
      }
      this.page.drawLine({
        start: { x: MARGIN, y: this.y - 12 },
        end: { x: A4_WIDTH - MARGIN, y: this.y - 12 },
        thickness: 0.4,
        color: LINE,
      });
      this.y -= 13;
    }
  }
}

function drawSummary(builder: ReportBuilder, report: AchievementReport): void {
  builder.section("Ringkasan capaian");
  builder.table(
    [
      { label: "Indikator", width: 190 },
      { label: "Nilai", width: CONTENT_WIDTH - 190, align: "right" },
    ],
    [
      ["Konten disetujui periode ini", number(report.totals.approved)],
      [
        "Target periode",
        report.totals.target === null
          ? "Belum ditetapkan"
          : number(report.totals.target),
      ],
      ["Capaian terhadap target", percent(report.totals.achievement)],
      ["Disetujui melalui validasi cabang", number(report.totals.approvedByBranch)],
      ["Organisasi dalam cakupan", number(report.totals.organizations)],
      ...report.totals.contentTypes.map((type) => [
        `Konten ${type.label}`,
        number(type.total),
      ]),
    ],
  );
}

function drawSources(builder: ReportBuilder, report: AchievementReport): void {
  if (report.sources.length === 0) return;
  builder.section("Capaian per sumber input");
  builder.table(
    [
      { label: "Sumber", width: 130 },
      { label: "Organisasi", width: 70, align: "right" },
      { label: "Disetujui", width: 70, align: "right" },
      { label: "Target", width: 75, align: "right" },
      { label: "Capaian", width: CONTENT_WIDTH - 345, align: "right" },
    ],
    report.sources.map((row) => [
      row.label,
      number(row.organizations),
      number(row.approved),
      row.target === null ? "-" : number(row.target),
      percent(row.achievement),
    ]),
  );
}

function drawOrganizations(
  builder: ReportBuilder,
  report: AchievementReport,
): void {
  builder.section("Capaian per organisasi");
  builder.table(
    [
      { label: "Organisasi", width: 150 },
      { label: "Cabang", width: 100 },
      { label: "Sumber", width: 80 },
      { label: "Disetujui", width: 55, align: "right" },
      { label: "Target", width: 50, align: "right" },
      { label: "Capaian", width: CONTENT_WIDTH - 435, align: "right" },
    ],
    report.organizations.map((row) => [
      row.name,
      row.branchName ?? "-",
      row.source.replace("FASKES_", "Faskes "),
      number(row.approved),
      row.target === null ? "-" : number(row.target),
      percent(row.achievement),
    ]),
  );
}

function drawContents(builder: ReportBuilder, report: AchievementReport): void {
  builder.section("Daftar konten disetujui");
  builder.text(
    report.truncated
      ? "Daftar dibatasi 400 konten terbaru pada periode ini."
      : `${number(report.rows.length)} konten disetujui pada periode ini.`,
    { size: 8, color: MUTED },
  );
  builder.gap(2);
  builder.table(
    [
      { label: "No", width: 24 },
      { label: "Disetujui", width: 58 },
      { label: "Judul", width: 150 },
      { label: "Organisasi", width: 108 },
      { label: "Jenis", width: 52 },
      { label: "Tema", width: CONTENT_WIDTH - 392 },
    ],
    report.rows.map((row, index) => [
      String(index + 1),
      row.approvedAt ? formatDateId(row.approvedAt) : "-",
      row.title ?? "(tanpa judul)",
      row.organization,
      row.contentType === "VIDEO"
        ? "Video"
        : row.contentType === "INFOGRAFIS"
          ? "Infografis"
          : "-",
      row.subTheme ?? "-",
    ]),
  );
}

function drawFooter(
  page: PDFPage,
  font: PDFFont,
  pageNumber: number,
  total: number,
  report: AchievementReport,
): void {
  const text = safe(
    `DAKOSTA - Laporan Pencapaian Konten - ${report.periodLabel} - Halaman ${pageNumber} dari ${total}`,
  );
  page.drawLine({
    start: { x: MARGIN, y: 30 },
    end: { x: A4_WIDTH - MARGIN, y: 30 },
    thickness: 0.5,
    color: LINE,
  });
  page.drawText(text, {
    x: MARGIN,
    y: 18,
    size: 7,
    font,
    color: MUTED,
  });
}

export async function renderAchievementPdf(
  report: AchievementReport,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(`Laporan Pencapaian Konten ${report.periodLabel}`));
  doc.setAuthor("DAKOSTA");
  doc.setSubject("Laporan pencapaian konten terhadap target");
  doc.setCreator("DAKOSTA analytics");
  doc.setProducer("DAKOSTA");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
  page.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 5,
    width: A4_WIDTH,
    height: 5,
    color: GREEN,
  });
  page.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 74,
    width: A4_WIDTH,
    height: 69,
    color: GREEN,
  });
  page.drawText("DAKOSTA", {
    x: MARGIN,
    y: A4_HEIGHT - 34,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Laporan Pencapaian Konten", {
    x: MARGIN,
    y: A4_HEIGHT - 56,
    size: 19,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(safe(`Periode ${report.periodLabel}`), {
    x: MARGIN,
    y: A4_HEIGHT - 70,
    size: 9,
    font,
    color: rgb(0.9, 0.97, 0.93),
  });

  const builder = new ReportBuilder(doc, font, bold, page);
  builder.setCursor(A4_HEIGHT - 92);
  builder.text(
    `Cakupan: ${report.scope.label}${report.scope.organizationName ? ` - ${report.scope.organizationName}` : ""}`,
    { size: 8.5, color: MUTED },
  );
  builder.text(
    `Dibuat: ${formatDateId(report.generatedAt)} | Peran: ${report.scope.role.replace("_", " ")}`,
    { size: 8.5, color: MUTED, lineHeight: 13 },
  );
  drawSummary(builder, report);
  drawSources(builder, report);
  drawOrganizations(builder, report);
  drawContents(builder, report);

  builder.gap(10);
  builder.text(
    "Catatan: laporan dihitung dari konten berstatus disetujui berdasarkan tanggal disetujui. Data operasional internal, tanpa data pribadi.",
    { size: 7, color: MUTED },
  );

  const pages = doc.getPages();
  pages.forEach((item, index) => {
    drawFooter(item, font, index + 1, pages.length, report);
  });

  return doc.save();
}
