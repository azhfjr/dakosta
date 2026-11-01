import { describe, expect, it } from "vitest";

import { DEMO_CHUNK, chunk } from "../scripts/demo-chunk";

describe("chunk", () => {
  it("splits rows and keeps the remainder", () => {
    const rows = Array.from({ length: 1207 }, (_, index) => index);
    const parts = chunk(rows);
    expect(parts).toHaveLength(3);
    expect(parts.map((part) => part.length)).toEqual([500, 500, 207]);
    expect(parts.flat()).toEqual(rows);
  });

  it("handles empty and exactly-sized inputs", () => {
    expect(chunk([])).toEqual([]);
    expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
    expect(chunk([1, 2, 3, 4], 3)).toEqual([[1, 2, 3], [4]]);
  });

  it("rejects invalid sizes", () => {
    expect(() => chunk([1], 0)).toThrow();
    expect(() => chunk([1], -1)).toThrow();
    expect(() => chunk([1], 1.5)).toThrow();
  });

  it("keeps the default chunk well below the bind parameter limit", () => {
    expect(DEMO_CHUNK).toBe(500);
    expect(DEMO_CHUNK * 40).toBeLessThan(65_535);
  });
});
