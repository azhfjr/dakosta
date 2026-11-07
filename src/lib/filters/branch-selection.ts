import { buildFilterHref, type FilterParams } from "@/lib/filters/query";

export type BranchSelectionMode = "all" | "none" | "subset" | "not-applicable";

export type BranchSelection = {
  mode: BranchSelectionMode;
  ids: string[];
};

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function uniqueSorted(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort(compareIds);
}

function rawBranchValues(params: FilterParams): string[] {
  const raw = params.cabang;
  if (raw === undefined) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Parses the shareable `cabang` parameter. The request is always intersected
 * with branches the caller is allowed to see, so a modified URL can never widen
 * scope. `none` wins over any other value.
 */
export function parseBranchSelection(
  params: FilterParams,
  allowedIds: readonly string[],
): BranchSelection {
  const allowed = uniqueSorted(allowedIds);
  if (allowed.length === 0) return { mode: "not-applicable", ids: [] };

  const values = rawBranchValues(params);
  if (values.length === 0) return { mode: "all", ids: allowed };
  if (values.some((value) => value.toLowerCase() === "none")) {
    return { mode: "none", ids: [] };
  }

  const canonical = new Map(allowed.map((id) => [id.toLowerCase(), id]));
  const selected = uniqueSorted(
    values.flatMap((value) => canonical.get(value.toLowerCase()) ?? []),
  );

  if (selected.length === 0) return { mode: "none", ids: [] };
  if (selected.length === allowed.length) return { mode: "all", ids: allowed };
  return { mode: "subset", ids: selected };
}

/** Stable cache part; the read-cache key already includes role and scope. */
export function branchSelectionKey(selection: BranchSelection): string {
  if (selection.mode === "all" || selection.mode === "subset") {
    return `${selection.mode}:${uniqueSorted(selection.ids).join(",")}`;
  }
  return selection.mode;
}

/**
 * Rewrites only `cabang` while preserving every other filter parameter, so old
 * dashboard links keep working.
 */
export function branchSelectionHref(
  basePath: string,
  params: FilterParams,
  selection: BranchSelection,
  options: { hash?: string } = {},
): string {
  const override =
    selection.mode === "subset"
      ? selection.ids.length > 0
        ? selection.ids
        : "none"
      : selection.mode === "none"
        ? "none"
        : null;
  return buildFilterHref(basePath, params, { cabang: override }, options);
}

export function selectedBranchIds(
  selection: BranchSelection,
  allowedIds: readonly string[],
): Set<string> {
  if (selection.mode === "all") return new Set(allowedIds);
  if (selection.mode === "subset") return new Set(selection.ids);
  return new Set();
}

function fromSelected(
  selected: Iterable<string>,
  allowedIds: readonly string[],
): BranchSelection {
  const allowed = uniqueSorted(allowedIds);
  if (allowed.length === 0) return { mode: "not-applicable", ids: [] };

  const allowedSet = new Set(allowed);
  const ids = uniqueSorted([...selected].filter((id) => allowedSet.has(id)));
  if (ids.length === 0) return { mode: "none", ids: [] };
  if (ids.length === allowed.length) return { mode: "all", ids: allowed };
  return { mode: "subset", ids };
}

export function toggleBranchSelection(
  current: BranchSelection,
  allowedIds: readonly string[],
  branchId: string,
): BranchSelection {
  const selected = selectedBranchIds(current, allowedIds);
  if (selected.has(branchId)) selected.delete(branchId);
  else selected.add(branchId);
  return fromSelected(selected, allowedIds);
}

export function toggleAllBranches(
  current: BranchSelection,
  allowedIds: readonly string[],
): BranchSelection {
  const allSelected =
    current.mode === "all" ||
    (current.mode === "subset" && current.ids.length === allowedIds.length);
  return allSelected
    ? { mode: "none", ids: [] }
    : fromSelected(allowedIds, allowedIds);
}

/** Normalises an arbitrary ID set against the allowed universe. */
export function branchSelectionFromIds(
  ids: Iterable<string>,
  allowedIds: readonly string[],
): BranchSelection {
  return fromSelected(ids, allowedIds);
}
