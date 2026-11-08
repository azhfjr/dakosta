import { describe, expect, it } from "vitest";

import { formatShareId, rankingShare } from "@/lib/dashboard/ranking";

describe("rankingShare", () => {
  it("returns zero when the row or the total is not positive", () => {
    expect(rankingShare(0, 100)).toBe(0);
    expect(rankingShare(10, 0)).toBe(0);
    expect(rankingShare(-5, 100)).toBe(0);
    expect(rankingShare(10, -100)).toBe(0);
    expect(rankingShare(Number.NaN, 100)).toBe(0);
    expect(rankingShare(10, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("measures the row as a share of the category total", () => {
    expect(rankingShare(50, 200)).toBe(25);
    expect(rankingShare(200, 200)).toBe(100);
    expect(rankingShare(1, 3)).toBeCloseTo(33.333, 3);
  });

  it("clamps above 100 and keeps ties equally proportioned", () => {
    expect(rankingShare(250, 200)).toBe(100);
    expect(rankingShare(40, 200)).toBe(rankingShare(40, 200));
    expect(rankingShare(40, 200)).toBeLessThan(rankingShare(80, 200));
    expect(rankingShare(40, 200)).toBeGreaterThan(rankingShare(20, 200));
  });
});

describe("formatShareId", () => {
  it("formats Indonesian percentages with at most one decimal", () => {
    expect(formatShareId(33.333)).toBe("33,3%");
    expect(formatShareId(100)).toBe("100%");
    expect(formatShareId(0)).toBe("0%");
    expect(formatShareId(12.04)).toBe("12%");
    expect(formatShareId(12.06)).toBe("12,1%");
  });
});
