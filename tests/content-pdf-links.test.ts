import { describe, expect, it } from "vitest";

import type { AnalyticsContentRow } from "@/lib/analytics/content-table";
import { parseKontenFilters } from "@/lib/filters/konten";
import { absoluteContentUrl } from "@/lib/reports/content-links";
import { renderContentReportPdf } from "@/lib/reports/content-pdf";

function row(
  index: number,
  overrides: Partial<AnalyticsContentRow> = {},
): AnalyticsContentRow {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    referenceCode: `DKS-TAUTAN-${index}`,
    title: `Konten tautan nomor ${index}`,
    organization: "Puskesmas Tautan",
    branchName: "Cabang Tautan",
    organizationType: "FASKES",
    faskesClass: "PRATAMA",
    source: "FASKES_FKTP",
    sourceLabel: "Faskes",
    contentType: "VIDEO",
    mainTheme: "EDUFAST",
    subTheme: "EDUKATIF_PERSUASIF",
    platform: "INSTAGRAM",
    status: "APPROVED",
    dateCreated: "2026-11-01",
    submittedAt: new Date("2026-11-01T02:00:00Z"),
    approvedAt: new Date("2026-11-02T02:00:00Z"),
    decisionAt: new Date("2026-11-02T02:00:00Z"),
    decidedBy: "BRANCH_ADMIN",
    decisionSource: "BRANCH",
    version: 1,
    resubmissionCount: 0,
    publishedUrl: null,
    ...overrides,
  };
}

async function linkUris(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  try {
    const uris: string[] = [];
    for (let index = 1; index <= doc.numPages; index += 1) {
      const page = await doc.getPage(index);
      const annotations = await page.getAnnotations();
      for (const annotation of annotations) {
        if (annotation.subtype === "Link" && annotation.url) {
          uris.push(annotation.url);
        }
      }
    }
    return uris;
  } finally {
    await doc.destroy();
  }
}

describe("content report links", () => {
  it("resolves published and fallback URLs safely", () => {
    expect(
      absoluteContentUrl({
        role: "MASTER_ADMIN",
        id: "abc",
        publishedUrl: "https://example.test/konten/abc",
      }),
    ).toBe("https://example.test/konten/abc");
    expect(
      absoluteContentUrl({
        role: "STAKEHOLDER",
        id: "abc",
        publishedUrl: "/konten/abc",
      }),
    ).toBe("http://localhost:3000/konten/abc");
    expect(
      absoluteContentUrl({
        role: "REGIONAL_ADMIN",
        id: "abc",
        publishedUrl: "javascript:alert(1)",
      }),
    ).toBe("http://localhost:3000/wilayah/konten/abc");
  });

  it("adds one URI annotation per rendered row", async () => {
    const rows = [
      row(1, { publishedUrl: "https://example.test/konten/terbit" }),
      row(2, { publishedUrl: null }),
      row(3, { publishedUrl: "/konten/relatif" }),
    ];
    const bytes = await renderContentReportPdf({
      scopeLabel: "Nasional",
      roleLabel: "Master Admin",
      role: "MASTER_ADMIN",
      filters: parseKontenFilters({}, "approved"),
      rows,
      total: rows.length,
      generatedAt: new Date("2026-11-09T01:00:00Z"),
    });

    const uris = await linkUris(bytes);
    expect(uris).toHaveLength(rows.length);
    expect(uris).toContain("https://example.test/konten/terbit");
    expect(uris).toContain(
      "http://localhost:3000/admin/konten/00000000-0000-4000-8000-000000000002",
    );
    expect(uris).toContain("http://localhost:3000/konten/relatif");
  });
});
