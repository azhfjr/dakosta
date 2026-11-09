import { describe, expect, it } from "vitest";

import {
  buildMonthlySeries,
  buildThemeMonthly,
  buildTypeMonthly,
  contentTypeKey,
  contentTypeSlices,
  emptyMonthlySeries,
  largestRemainderShares,
  monthAxisLabel,
  themeKey,
  trailingMonthKeys,
} from "@/lib/dashboard/series";

const REFERENCE = new Date("2026-11-09T01:00:00Z");

describe("trailingMonthKeys", () => {
  it("returns twelve chronological Jakarta months including the current one", () => {
    const keys = trailingMonthKeys(REFERENCE, 12);
    expect(keys).toHaveLength(12);
    expect(keys[0]).toBe("2025-12");
    expect(keys.at(-1)).toBe("2026-11");
    expect([...keys].sort()).toEqual(keys);
  });

  it("rolls over at the Jakarta month boundary, not UTC", () => {
    // 2026-10-31T17:30Z is already 2026-11-01 00:30 in Jakarta.
    expect(trailingMonthKeys(new Date("2026-10-31T17:30:00Z"), 1)).toEqual([
      "2026-11",
    ]);
    expect(monthAxisLabel("2026-11")).toBe("Nov");
  });
});

describe("buildMonthlySeries", () => {
  it("zero-fills gaps and ignores rows outside the window", () => {
    const series = buildMonthlySeries(
      [
        { key: "2026-11", total: 4 },
        { key: "2026-11", total: 6 },
        { key: "2026-09", total: 3 },
        { key: "2024-01", total: 99 },
      ],
      REFERENCE,
    );
    expect(series.points).toHaveLength(12);
    expect(series.total).toBe(13);
    expect(series.points.find((point) => point.key === "2026-11")?.total).toBe(
      10,
    );
    expect(series.points.find((point) => point.key === "2026-10")?.total).toBe(
      0,
    );
    expect(series.startKey).toBe("2025-12");
    expect(series.endKey).toBe("2026-11");
  });

  it("returns an all-zero window for the empty state", () => {
    const series = emptyMonthlySeries(REFERENCE);
    expect(series.total).toBe(0);
    expect(series.points).toHaveLength(12);
    expect(series.points.every((point) => point.total === 0)).toBe(true);
  });
});

describe("largestRemainderShares", () => {
  it("always distributes exactly 100.0%", () => {
    const cases = [
      [1, 1, 1],
      [2, 1],
      [1, 2, 3, 4],
      [1, 1, 1, 1, 1, 1, 1],
      [7, 0, 5],
    ];
    for (const values of cases) {
      const total = values.reduce((sum, value) => sum + value, 0);
      const shares = largestRemainderShares(values, total);
      expect(
        Math.round(shares.reduce((sum, value) => sum + value, 0) * 10),
      ).toBe(1000);
    }
    expect(largestRemainderShares([1, 1, 1], 3)).toEqual([33.4, 33.3, 33.3]);
    expect(largestRemainderShares([0, 0], 0)).toEqual([0, 0]);
  });
});

describe("content type helpers", () => {
  it("normalizes unknown values to the unclassified bucket", () => {
    expect(contentTypeKey("VIDEO")).toBe("VIDEO");
    expect(contentTypeKey("INFOGRAFIS")).toBe("INFOGRAFIS");
    expect(contentTypeKey(null)).toBe("UNCLASSIFIED");
    expect(contentTypeKey("LAINNYA")).toBe("UNCLASSIFIED");
    expect(themeKey("EDUFAST")).toBe("EDUFAST");
    expect(themeKey("NON_EDUFAST")).toBe("NON_EDUFAST");
    expect(themeKey(null)).toBe("NON_EDUFAST");
  });

  it("builds ordered slices whose shares sum to 100.0", () => {
    const slices = contentTypeSlices({
      VIDEO: 7,
      INFOGRAFIS: 3,
      UNCLASSIFIED: 1,
    });
    expect(slices.map((slice) => slice.type)).toEqual([
      "VIDEO",
      "INFOGRAFIS",
      "UNCLASSIFIED",
    ]);
    expect(slices.map((slice) => slice.label)).toEqual([
      "Video",
      "Infografis",
      "Belum ditentukan",
    ]);
    expect(slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(
      100,
      5,
    );
    expect(contentTypeSlices({})).toEqual([]);
  });

  it("zero-fills every type month and keeps per-type totals", () => {
    const series = buildTypeMonthly(
      [
        { key: "2026-11", type: "VIDEO", total: 2 },
        { key: "2026-11", type: "VIDEO", total: 1 },
        { key: "2026-10", type: "INFOGRAFIS", total: 4 },
      ],
      REFERENCE,
    );
    expect(series.map((row) => row.type)).toEqual(["VIDEO", "INFOGRAFIS"]);
    expect(series[0]!.points).toHaveLength(12);
    expect(series[0]!.total).toBe(3);
    expect(series[1]!.total).toBe(4);
    expect(
      series[1]!.points.find((point) => point.key === "2026-11")?.total,
    ).toBe(0);
  });

  it("always exposes both theme series and matches month totals", () => {
    const series = buildThemeMonthly(
      [
        { key: "2026-11", theme: "EDUFAST", total: 5 },
        { key: "2026-10", theme: "NON_EDUFAST", total: 2 },
      ],
      REFERENCE,
    );
    expect(series.map((row) => row.key)).toEqual(["EDUFAST", "NON_EDUFAST"]);
    expect(series[0]!.total).toBe(5);
    expect(series[1]!.total).toBe(2);
    expect(series[0]!.points).toHaveLength(12);
  });
});
