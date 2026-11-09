import { describe, expect, it } from "vitest";

import {
  INFOGRAPHIC_SCALE,
  INFOGRAPHIC_WORKER_SRC,
  infographicExportFilename,
} from "@/lib/reports/infographic";

describe("dashboard infographic", () => {
  it("names the PNG by role and UTC date", () => {
    expect(
      infographicExportFilename(
        "REGIONAL_ADMIN",
        new Date("2026-11-09T01:00:00Z"),
      ),
    ).toBe("infografis-dakosta-regional_admin-2026-11-09.png");
  });

  it("renders at 300 DPI from the 72 DPI page", () => {
    expect(INFOGRAPHIC_SCALE).toBeCloseTo(300 / 72, 5);
    expect(Math.ceil(841.89 * INFOGRAPHIC_SCALE)).toBe(3508);
    expect(Math.ceil(595.28 * INFOGRAPHIC_SCALE)).toBe(2481);
    expect(INFOGRAPHIC_WORKER_SRC).toBe("/vendor/pdf.worker.min.mjs");
  });
});
