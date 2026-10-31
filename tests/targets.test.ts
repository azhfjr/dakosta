import { describe, expect, it } from "vitest";

import {
  resolveAggregateTarget,
  resolveTargetAmount,
  type TargetScopeSource,
} from "@/lib/targets";
import { targetCreateSchema, targetUpdateSchema } from "@/lib/validation/target";

const rows = [
  { stakeholderId: null, themeId: null, subTheme: null, targetCount: 30 },
  { stakeholderId: "a", themeId: null, subTheme: null, targetCount: 10 },
  { stakeholderId: "b", themeId: null, subTheme: null, targetCount: 8 },
  {
    stakeholderId: null,
    themeId: null,
    subTheme: "MOBILE_JKN",
    targetCount: 12,
  },
  {
    stakeholderId: "a",
    themeId: null,
    subTheme: "MOBILE_JKN",
    targetCount: 4,
  },
];

function sourceOf(
  result: { target: number | null; source: TargetScopeSource | null },
  target: number | null,
  source: TargetScopeSource,
) {
  expect(result).toEqual({ target, source });
}

describe("target resolver", () => {
  it("prefers stakeholder + sub-theme over every broader scope", () => {
    sourceOf(
      resolveTargetAmount(rows, { stakeholderId: "a", subTheme: "MOBILE_JKN" }),
      4,
      "STAKEHOLDER_SUB_THEME",
    );
  });

  it("falls back to stakeholder, then sub-theme, then global", () => {
    sourceOf(
      resolveTargetAmount(rows, { stakeholderId: "a", subTheme: null }),
      10,
      "STAKEHOLDER",
    );
    expect(
      resolveTargetAmount(rows, { stakeholderId: "b", subTheme: "MOBILE_JKN" }),
    ).toEqual({ target: null, source: null });
    sourceOf(
      resolveTargetAmount(rows, { stakeholderId: null, subTheme: "MOBILE_JKN" }),
      12,
      "SUB_THEME",
    );
    sourceOf(
      resolveTargetAmount(rows, { stakeholderId: null, subTheme: null }),
      30,
      "GLOBAL",
    );
  });

  it("maps legacy theme rows to their canonical sub-theme", () => {
    const legacy = [
      {
        stakeholderId: "a",
        themeId: "legacy-theme",
        themeSlug: "mobile-jkn",
        subTheme: null,
        targetCount: 6,
      },
    ];
    expect(
      resolveTargetAmount(legacy, {
        stakeholderId: "a",
        subTheme: "MOBILE_JKN",
      }),
    ).toEqual({ target: 6, source: "STAKEHOLDER_SUB_THEME" });
  });

  it("requires every owned stakeholder to have a target", () => {
    expect(
      resolveAggregateTarget(rows, ["a", "b"], null),
    ).toEqual({ target: 18, source: "AGGREGATE" });
    expect(
      resolveAggregateTarget(rows, ["a", "missing"], null),
    ).toEqual({ target: null, source: null });
    expect(resolveAggregateTarget(rows, [], null)).toEqual({
      target: null,
      source: null,
    });
  });
});

describe("target validation", () => {
  it("accepts a global target and normalizes optional scope", () => {
    expect(
      targetCreateSchema.parse({ month: "2026-10", targetCount: 30 }),
    ).toEqual({ month: "2026-10", targetCount: 30 });
  });

  it("accepts stakeholder and sub-theme scopes", () => {
    const parsed = targetCreateSchema.parse({
      month: "2026-10",
      stakeholderId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      subTheme: "MOBILE_JKN",
      targetCount: 5,
      reportingUnit: "konten",
    });
    expect(parsed.subTheme).toBe("MOBILE_JKN");
  });

  it("rejects invalid months, negative targets, and unknown sub-themes", () => {
    expect(
      targetCreateSchema.safeParse({ month: "2026-13", targetCount: 1 }).success,
    ).toBe(false);
    expect(
      targetCreateSchema.safeParse({ month: "2026-10", targetCount: -1 }).success,
    ).toBe(false);
    expect(
      targetCreateSchema.safeParse({
        month: "2026-10",
        subTheme: "LAINNYA",
        targetCount: 1,
      }).success,
    ).toBe(false);
  });

  it("requires at least one field when updating", () => {
    expect(targetUpdateSchema.safeParse({}).success).toBe(false);
    expect(targetUpdateSchema.safeParse({ targetCount: 0 }).success).toBe(true);
  });
});
