import { describe, expect, it } from "vitest";

import {
  branchSelectionHref,
  branchSelectionKey,
  parseBranchSelection,
  selectedBranchIds,
  toggleAllBranches,
  toggleBranchSelection,
} from "@/lib/filters/branch-selection";

const BRANCH_A = "11111111-1111-4111-8111-111111111111";
const BRANCH_B = "22222222-2222-4222-8222-222222222222";
const BRANCH_C = "33333333-3333-4333-8333-333333333333";
const OUTSIDE = "99999999-9999-4999-8999-999999999999";
const ALLOWED = [BRANCH_B, BRANCH_A];

describe("parseBranchSelection", () => {
  it("selects every allowed branch when cabang is absent", () => {
    expect(parseBranchSelection({}, ALLOWED)).toEqual({
      mode: "all",
      ids: [BRANCH_A, BRANCH_B],
    });
  });

  it("treats none as an authoritative empty selection", () => {
    expect(
      parseBranchSelection({ cabang: ["none", BRANCH_A] }, ALLOWED),
    ).toEqual({ mode: "none", ids: [] });
    expect(parseBranchSelection({ cabang: "NONE" }, ALLOWED)).toEqual({
      mode: "none",
      ids: [],
    });
  });

  it("accepts repeated and comma separated ids, deduped and sorted", () => {
    expect(
      parseBranchSelection(
        { cabang: [`${BRANCH_B},${BRANCH_A}`, BRANCH_B] },
        ALLOWED,
      ),
    ).toEqual({ mode: "all", ids: [BRANCH_A, BRANCH_B] });

    expect(parseBranchSelection({ cabang: BRANCH_B }, ALLOWED)).toEqual({
      mode: "subset",
      ids: [BRANCH_B],
    });
  });

  it("intersects with allowed branches and never widens scope", () => {
    expect(
      parseBranchSelection(
        { cabang: [OUTSIDE, "not-a-uuid", BRANCH_A] },
        ALLOWED,
      ),
    ).toEqual({ mode: "subset", ids: [BRANCH_A] });

    expect(
      parseBranchSelection({ cabang: [OUTSIDE, "not-a-uuid"] }, ALLOWED),
    ).toEqual({ mode: "none", ids: [] });
  });

  it("matches ids case insensitively against the canonical value", () => {
    expect(
      parseBranchSelection({ cabang: BRANCH_A.toUpperCase() }, ALLOWED),
    ).toEqual({ mode: "subset", ids: [BRANCH_A] });
  });

  it("is not applicable when the role has no branch in scope", () => {
    expect(parseBranchSelection({ cabang: BRANCH_A }, [])).toEqual({
      mode: "not-applicable",
      ids: [],
    });
    expect(parseBranchSelection({ cabang: "none" }, [])).toEqual({
      mode: "not-applicable",
      ids: [],
    });
  });
});

describe("branchSelectionHref", () => {
  it("drops cabang for the all selection while keeping other filters", () => {
    const href = branchSelectionHref(
      "/admin",
      { cabang: BRANCH_A, period: "2026-01", view: "peta" },
      { mode: "all", ids: [BRANCH_A, BRANCH_B] },
    );
    expect(href).toBe("/admin?period=2026-01&view=peta");
  });

  it("writes cabang=none for an empty selection", () => {
    const href = branchSelectionHref(
      "/wilayah/dashboard",
      { period: "2026-01" },
      { mode: "none", ids: [] },
    );
    expect(href).toBe("/wilayah/dashboard?period=2026-01&cabang=none");
  });

  it("writes repeated sorted ids for a subset", () => {
    const href = branchSelectionHref(
      "/cabang/dashboard",
      { view: "peta" },
      { mode: "subset", ids: [BRANCH_A, BRANCH_C] },
    );
    expect(href).toBe(
      `/cabang/dashboard?cabang=${BRANCH_A}&cabang=${BRANCH_C}&view=peta`,
    );
  });

  it("preserves the hash used by legacy map links", () => {
    expect(
      branchSelectionHref(
        "/admin",
        {},
        { mode: "none", ids: [] },
        { hash: "peta" },
      ),
    ).toBe("/admin?cabang=none#peta");
  });
});

describe("selection helpers", () => {
  it("toggles a single branch and normalises all/none boundaries", () => {
    const all = parseBranchSelection({}, ALLOWED);
    expect(toggleBranchSelection(all, ALLOWED, BRANCH_A)).toEqual({
      mode: "subset",
      ids: [BRANCH_B],
    });
    expect(
      toggleBranchSelection({ mode: "none", ids: [] }, ALLOWED, BRANCH_A),
    ).toEqual({ mode: "subset", ids: [BRANCH_A] });
    expect(
      toggleBranchSelection(
        { mode: "subset", ids: [BRANCH_A] },
        ALLOWED,
        BRANCH_B,
      ),
    ).toEqual({ mode: "all", ids: [BRANCH_A, BRANCH_B] });
    expect(
      toggleBranchSelection(
        { mode: "subset", ids: [BRANCH_A] },
        ALLOWED,
        BRANCH_A,
      ),
    ).toEqual({ mode: "none", ids: [] });
  });

  it("toggles every branch in one step", () => {
    expect(toggleAllBranches({ mode: "all", ids: ALLOWED }, ALLOWED)).toEqual({
      mode: "none",
      ids: [],
    });
    expect(
      toggleAllBranches({ mode: "subset", ids: [BRANCH_A] }, ALLOWED),
    ).toEqual({ mode: "all", ids: [BRANCH_A, BRANCH_B] });
    expect(toggleAllBranches({ mode: "none", ids: [] }, [])).toEqual({
      mode: "not-applicable",
      ids: [],
    });
  });

  it("exposes the effective selected ids for rendering", () => {
    expect([
      ...selectedBranchIds({ mode: "all", ids: ALLOWED }, ALLOWED),
    ]).toEqual(ALLOWED);
    expect([
      ...selectedBranchIds({ mode: "subset", ids: [BRANCH_A] }, ALLOWED),
    ]).toEqual([BRANCH_A]);
    expect([...selectedBranchIds({ mode: "none", ids: [] }, ALLOWED)]).toEqual(
      [],
    );
  });

  it("builds a stable cache key", () => {
    expect(
      branchSelectionKey({ mode: "subset", ids: [BRANCH_A, BRANCH_B] }),
    ).toBe(`subset:${BRANCH_A},${BRANCH_B}`);
    expect(branchSelectionKey({ mode: "all", ids: ALLOWED })).toBe(
      `all:${BRANCH_A},${BRANCH_B}`,
    );
    expect(branchSelectionKey({ mode: "none", ids: [] })).toBe("none");
  });
});
