import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

export const REPORT_PAGE = {
  width: 841.89,
  height: 595.28,
  margin: 36,
} as const;

export const REPORT_CONTENT_WIDTH = REPORT_PAGE.width - REPORT_PAGE.margin * 2;

export const REPORT_COLORS = {
  brand: rgb(0, 0.42, 0.235),
  ink: rgb(0.07, 0.165, 0.22),
  muted: rgb(0.31, 0.404, 0.475),
  line: rgb(0.85, 0.9, 0.88),
  surface: rgb(0.965, 0.98, 0.972),
  white: rgb(1, 1, 1),
} as const;

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

/**
 * Standard Helvetica only encodes WinAnsi; keep the report legible instead of
 * throwing on Indonesian punctuation.
 */
export function safe(value: string): string {
  return value
    .replace(/[·–—…×’‘“”≥≤•\u00a0]/g, (char) => REPLACEMENTS[char] ?? "")
    .replace(/[^\x20-\x7E]/g, "");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function fitText(
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

/** Word-wrap that never truncates and hard-breaks tokens that cannot fit. */
export function wrapText(
  font: PDFFont,
  value: string,
  size: number,
  maxWidth: number,
): string[] {
  const clean = safe(value).trim();
  if (!clean) return [""];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }
    let fragment = "";
    for (const char of word) {
      if (font.widthOfTextAtSize(fragment + char, size) > maxWidth) {
        lines.push(fragment);
        fragment = char;
      } else {
        fragment += char;
      }
    }
    current = fragment;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

const LOGO_PATH = "public/brand/dakosta-logo-vector-transparent-3840x1280.png";

/** Returns null when the asset is missing so reports still render. */
export async function loadBrandLogo(
  doc: PDFDocument,
): Promise<PDFImage | null> {
  try {
    const file = await readFile(path.join(process.cwd(), LOGO_PATH));
    return await doc.embedPng(file);
  } catch {
    return null;
  }
}

export function drawLogo(
  page: PDFPage,
  logo: PDFImage | null,
  options: { x: number; y: number; height: number },
): void {
  if (!logo) return;
  const width = (logo.width / logo.height) * options.height;
  page.drawImage(logo, {
    x: options.x,
    y: options.y,
    width,
    height: options.height,
  });
}

export function setReportMetadata(
  doc: PDFDocument,
  meta: { title: string; subject: string; author?: string },
): void {
  doc.setTitle(safe(meta.title));
  doc.setAuthor(meta.author ?? "DAKOSTA");
  doc.setSubject(safe(meta.subject));
  doc.setCreator("DAKOSTA");
  doc.setProducer("DAKOSTA");
}

export type ReportFonts = { font: PDFFont; bold: PDFFont };

/** Low-level Link annotation; pdf-lib has no high-level helper for URI actions. */
export function addUriAnnotation(
  page: PDFPage,
  rect: { x: number; y: number; width: number; height: number },
  uri: string,
): void {
  const context = page.doc.context;
  const annotation = context.register(
    context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFString.of(uri),
      },
    }),
  );
  page.node.addAnnot(annotation);
}

export async function loadReportFonts(doc: PDFDocument): Promise<ReportFonts> {
  return {
    font: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
}

/** White band + green rule, logo on the right, document title on the left. */
export function drawReportHeader(
  page: PDFPage,
  fonts: ReportFonts,
  logo: PDFImage | null,
  input: { title: string; subtitle?: string },
): number {
  const headerHeight = 62;
  page.drawRectangle({
    x: 0,
    y: REPORT_PAGE.height - 5,
    width: REPORT_PAGE.width,
    height: 5,
    color: REPORT_COLORS.brand,
  });
  const logoHeight = 26;
  if (logo) {
    drawLogo(page, logo, {
      x: REPORT_PAGE.width - REPORT_PAGE.margin - 84,
      y: REPORT_PAGE.height - headerHeight + 18,
      height: logoHeight,
    });
  }
  page.drawText(fitText(fonts.bold, input.title, 15, 520), {
    x: REPORT_PAGE.margin,
    y: REPORT_PAGE.height - 32,
    size: 15,
    font: fonts.bold,
    color: REPORT_COLORS.ink,
  });
  if (input.subtitle) {
    page.drawText(fitText(fonts.font, input.subtitle, 8.5, 560), {
      x: REPORT_PAGE.margin,
      y: REPORT_PAGE.height - 47,
      size: 8.5,
      font: fonts.font,
      color: REPORT_COLORS.muted,
    });
  }
  page.drawLine({
    start: { x: REPORT_PAGE.margin, y: REPORT_PAGE.height - headerHeight },
    end: {
      x: REPORT_PAGE.width - REPORT_PAGE.margin,
      y: REPORT_PAGE.height - headerHeight,
    },
    thickness: 0.6,
    color: REPORT_COLORS.line,
  });
  return REPORT_PAGE.height - headerHeight;
}

export function drawReportFooter(
  page: PDFPage,
  fonts: ReportFonts,
  logo: PDFImage | null,
  input: {
    pageNumber: number;
    totalPages: number;
    metadata: string;
  },
): void {
  page.drawLine({
    start: { x: REPORT_PAGE.margin, y: 30 },
    end: { x: REPORT_PAGE.width - REPORT_PAGE.margin, y: 30 },
    thickness: 0.5,
    color: REPORT_COLORS.line,
  });
  page.drawText(
    fitText(
      fonts.font,
      `DAKOSTA - ${input.metadata} - Halaman ${input.pageNumber} dari ${input.totalPages}`,
      7,
      REPORT_CONTENT_WIDTH - 70,
    ),
    {
      x: REPORT_PAGE.margin,
      y: 17,
      size: 7,
      font: fonts.font,
      color: REPORT_COLORS.muted,
    },
  );
  drawLogo(page, logo, {
    x: REPORT_PAGE.width - REPORT_PAGE.margin - 54,
    y: 13,
    height: 11,
  });
}
