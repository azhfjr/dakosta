import { describe, expect, it } from "vitest";

import { csvFileName, toCsv } from "@/lib/csv";

describe("CSV export", () => {
  it("starts with a UTF-8 BOM and uses CRLF line endings", () => {
    const csv = toCsv(["nama"], [["Faskes Demo"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\r\n");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    const csv = toCsv(["catatan"], [['Ada, koma "kutip"\nbaris baru']]);
    expect(csv).toContain('"Ada, koma ""kutip""\nbaris baru"');
  });

  it("neutralizes spreadsheet formula injection", () => {
    const csv = toCsv(
      ["nilai"],
      [['=HYPERLINK("http://evil")'], ["+1"], ["-1"], ["@cmd"]],
    );
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+1");
    expect(csv).toContain("'-1");
    expect(csv).toContain("'@cmd");
  });

  it("renders empty values as empty cells", () => {
    const csv = toCsv(["a", "b"], [[null, undefined]]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toBe(",");
  });

  it("builds a Jakarta-dated file name", () => {
    const name = csvFileName("konten", new Date("2026-10-31T17:30:00.000Z"));
    expect(name).toBe("konten-2026-11-01.csv");
  });

  it("uses the reporting period in the export file name when provided", () => {
    expect(csvFileName("dakosta-konten", new Date(), "2026-10")).toBe(
      "dakosta-konten-2026-10.csv",
    );
  });
});
