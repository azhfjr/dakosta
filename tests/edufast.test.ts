import { describe, expect, it } from "vitest";

import {
  assertEdufastSelection,
  resolveEdufastForDate,
  type EdufastPolicy,
} from "@/lib/edufast/policy";

const policy: EdufastPolicy = {
  id: "policy-oct",
  period: "2026-10",
  timezone: "Asia/Jakarta",
  status: "PUBLISHED",
  version: 2,
  explanation: null,
  publishedAt: new Date("2026-10-01T00:00:00.000Z"),
  createdAt: new Date("2026-09-30T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  subThemes: ["MOBILE_JKN", "INFORMASI"],
  createdBy: "master",
  publishedBy: "master",
};

const load = async (period: string) =>
  period === policy.period ? policy : null;

describe("EDUFAST policy window", () => {
  it("blocks EDUFAST when the content period has no published policy", async () => {
    const resolution = await resolveEdufastForDate("2026-11-05", load);
    expect(resolution.allowed).toBe(false);
    if (!resolution.allowed) {
      expect(resolution.period).toBe("2026-11");
      expect(resolution.reason).toMatch(/November 2026/);
    }
  });

  it("resolves the policy for the content month, not the submission date", async () => {
    const resolution = await resolveEdufastForDate("2026-10-31", load);
    expect(resolution.allowed).toBe(true);
  });

  it("rejects a sub-theme outside the published window", async () => {
    await expect(
      assertEdufastSelection(
        {
          dateCreated: "2026-10-15",
          mainTheme: "EDUFAST",
          subTheme: "KORPORAT",
        },
        load,
      ),
    ).rejects.toThrow(
      /Korporat tidak termasuk kebijakan EDUFAST 2026-10 \(versi 2\)/,
    );
  });

  it("records the policy id and version for an allowed selection", async () => {
    await expect(
      assertEdufastSelection(
        {
          dateCreated: "2026-10-15",
          mainTheme: "EDUFAST",
          subTheme: "MOBILE_JKN",
        },
        load,
      ),
    ).resolves.toEqual({ policyId: "policy-oct", policyVersion: 2 });
  });

  it("does not consult the policy for Non-EDUFAST content", async () => {
    let called = 0;
    const result = await assertEdufastSelection(
      {
        dateCreated: "2026-10-15",
        mainTheme: "NON_EDUFAST",
        subTheme: "INFORMASI",
      },
      async () => {
        called += 1;
        return null;
      },
    );
    expect(result).toEqual({ policyId: null, policyVersion: null });
    expect(called).toBe(0);
  });
});
