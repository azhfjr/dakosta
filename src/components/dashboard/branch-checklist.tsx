"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ChevronDown } from "lucide-react";

import {
  branchSelectionFromIds,
  branchSelectionHref,
  selectedBranchIds,
  toggleAllBranches,
  toggleBranchSelection,
  type BranchSelection,
} from "@/lib/filters/branch-selection";
import type { FilterParams } from "@/lib/filters/query";
import type { DashboardBranchRow } from "@/lib/dashboard/types";

const REGION_PREFIX = "region:";

// The URL the dashboard was hydrated with. Next seeds its route cache from this
// URL including the hash; navigating back to the same route appends the hash
// again, producing `#anchor#anchor`. Captured once at module load, before any
// client-side navigation can change it.
const hydrationHref =
  typeof window === "undefined"
    ? null
    : `${window.location.pathname}${window.location.search}${window.location.hash}`;

function TriStateCheckbox({
  id,
  checked,
  indeterminate = false,
  disabled,
  onChange,
  label,
  className,
}: {
  id: string;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.currentTarget.checked)}
      className={
        className ??
        "size-4 shrink-0 rounded border-border accent-[var(--brand-green-700)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-60"
      }
    />
  );
}

export function BranchChecklist({
  basePath,
  params,
  branches,
  selection,
}: {
  basePath: string;
  params: FilterParams;
  branches: DashboardBranchRow[];
  selection: BranchSelection;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [listOpen, setListOpen] = useState(false);
  const pendingHash = useRef<string | null>(null);

  // Next seeds its route cache with the hydration URL including the hash, then
  // appends `url.hash` again when navigating back to that route, producing
  // `#anchor#anchor`. Normalize to exactly one hash after the navigation commits.
  useLayoutEffect(() => {
    const hash = pendingHash.current;
    pendingHash.current = null;
    if (!hash) return;
    const target = `${window.location.pathname}${window.location.search}#${hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current === target) return;
    window.history.replaceState(null, "", target);
  }, [pathname, searchParams]);
  const allowedIds = useMemo(
    () => branches.map((branch) => branch.id),
    [branches],
  );
  const selected = useMemo(
    () => selectedBranchIds(selection, allowedIds),
    [selection, allowedIds],
  );

  const groups = useMemo(() => {
    const byRegion = new Map<string, DashboardBranchRow[]>();
    for (const branch of branches) {
      const key = branch.regionName ?? "Tanpa wilayah";
      const list = byRegion.get(key) ?? [];
      list.push(branch);
      byRegion.set(key, list);
    }
    return [...byRegion.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "id"))
      .map(([region, list]) => ({
        region,
        branches: [...list].sort((left, right) =>
          left.name.localeCompare(right.name, "id"),
        ),
      }));
  }, [branches]);

  function navigate(next: BranchSelection) {
    const hash = window.location.hash.replace(/^#/, "") || undefined;
    pendingHash.current = hash ?? null;
    const hrefWithoutHash = branchSelectionHref(basePath, params, next);
    const initialHashless = hydrationHref?.split("#")[0] ?? null;
    const initialHash = hydrationHref?.includes("#")
      ? `#${hydrationHref.slice(hydrationHref.indexOf("#") + 1)}`
      : "";
    const routerRestoresHash =
      initialHashless !== null &&
      initialHash !== "" &&
      window.location.hash === initialHash &&
      hrefWithoutHash === initialHashless;
    const href = routerRestoresHash
      ? hrefWithoutHash
      : branchSelectionHref(basePath, params, next, { hash });
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function onToggle(branchId: string, checked: boolean) {
    if (checked === selected.has(branchId)) return;
    navigate(toggleBranchSelection(selection, allowedIds, branchId));
  }

  function onToggleAll(checked: boolean) {
    if (checked === (selection.mode === "all")) return;
    navigate(toggleAllBranches(selection, allowedIds));
  }

  function onToggleRegion(
    regionBranches: DashboardBranchRow[],
    checked: boolean,
  ) {
    const next = new Set(selected);
    for (const branch of regionBranches) {
      if (checked) next.add(branch.id);
      else next.delete(branch.id);
    }
    navigate(branchSelectionFromIds(next, allowedIds));
  }

  const allSelected = selection.mode === "all";
  const someSelected = selected.size > 0 && !allSelected;
  const branchCount = branches.length;
  const selectedCount = selected.size;

  const regionValue = useMemo(() => {
    if (allSelected) return "all";
    for (const group of groups) {
      if (
        group.branches.length === selectedCount &&
        group.branches.every((branch) => selected.has(branch.id))
      ) {
        return `${REGION_PREFIX}${group.region}`;
      }
    }
    return "custom";
  }, [allSelected, groups, selected, selectedCount]);

  function onSelectRegion(value: string) {
    if (value === "all") {
      navigate(branchSelectionFromIds(allowedIds, allowedIds));
      return;
    }
    if (!value.startsWith(REGION_PREFIX)) return;
    const region = value.slice(REGION_PREFIX.length);
    const group = groups.find((item) => item.region === region);
    if (!group) return;
    navigate(
      branchSelectionFromIds(
        group.branches.map((branch) => branch.id),
        allowedIds,
      ),
    );
  }

  return (
    <section
      id="pilih-cabang"
      aria-labelledby="pilih-cabang-judul"
      aria-busy={pending}
      className="relative scroll-mt-20 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3
          id="pilih-cabang-judul"
          className="text-sm font-semibold text-foreground"
        >
          Cabang
        </h3>

        {branchCount === 0 ? (
          <div className="flex w-full items-start gap-2 rounded-lg border border-status-review/30 bg-status-review/5 px-3 py-2">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-status-review"
              aria-hidden
            />
            <p className="text-sm text-ink-muted">
              Tidak ada cabang dalam cakupan Anda, sehingga filter cabang tidak
              tersedia. Capaian tetap mengikuti cakupan organisasi Anda.
            </p>
          </div>
        ) : (
          <>
            <select
              aria-label="Wilayah"
              value={regionValue}
              disabled={pending}
              onChange={(event) => onSelectRegion(event.currentTarget.value)}
              className="h-9 max-w-44 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="all">Semua wilayah</option>
              {groups.map((group) => (
                <option
                  key={group.region}
                  value={`${REGION_PREFIX}${group.region}`}
                >
                  {group.region}
                </option>
              ))}
              <option value="custom" disabled={regionValue === "custom"}>
                Pilihan khusus
              </option>
            </select>

            <details
              open={listOpen}
              onToggle={(event) => setListOpen(event.currentTarget.open)}
              className="group"
            >
              <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border border-input bg-background px-2 text-sm font-medium text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                Cabang
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-semibold text-ink-muted tabular">
                  {selectedCount}/{branchCount}
                </span>
                <ChevronDown
                  className="size-3.5 text-ink-muted transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="absolute top-full right-3 left-3 z-30 mt-1 rounded-xl border border-border bg-surface p-3 shadow-xl sm:left-auto sm:w-[min(20rem,calc(100vw-2rem))]">
                <div
                  className="max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  role="region"
                  aria-label="Daftar cabang, dapat digulir"
                  tabIndex={0}
                >
                  {groups.map((group) => {
                    const groupSelected = group.branches.filter((branch) =>
                      selected.has(branch.id),
                    ).length;
                    const groupAll = groupSelected === group.branches.length;
                    const groupSome = groupSelected > 0 && !groupAll;
                    return (
                      <div
                        key={group.region}
                        data-region={group.region}
                        className="rounded-lg border border-border/70 p-2"
                      >
                        <label className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                          <TriStateCheckbox
                            id={`wilayah-${group.region.replace(/\s+/g, "-").toLowerCase()}`}
                            checked={groupAll}
                            indeterminate={groupSome}
                            disabled={pending}
                            onChange={(checked) =>
                              onToggleRegion(group.branches, checked)
                            }
                            label={`Pilih semua cabang di ${group.region}`}
                          />
                          {group.region}
                        </label>
                        <ul className="mt-1 space-y-1 pl-6">
                          {group.branches.map((branch) => (
                            <li key={branch.id}>
                              <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                                <TriStateCheckbox
                                  id={`cabang-${branch.id}`}
                                  checked={selected.has(branch.id)}
                                  disabled={pending}
                                  onChange={(checked) =>
                                    onToggle(branch.id, checked)
                                  }
                                  label={`Cabang ${branch.name}`}
                                />
                                <span className="min-w-0 break-words">
                                  {branch.name}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>

            <label
              htmlFor="pilih-semua-cabang"
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <TriStateCheckbox
                id="pilih-semua-cabang"
                checked={allSelected}
                indeterminate={someSelected}
                disabled={pending}
                onChange={onToggleAll}
                label="Pilih semua cabang"
              />
              Pilih Semua
            </label>

            <p className="text-sm text-ink-muted sm:ml-auto" aria-live="polite">
              <span className="font-semibold text-foreground tabular">
                {selectedCount} dari {branchCount}
              </span>{" "}
              cabang dipilih
            </p>
          </>
        )}
      </div>

      {branchCount > 0 && selectedCount === 0 ? (
        <p
          role="status"
          className="mt-2 rounded-md border border-status-review/30 bg-status-review/5 px-2.5 py-2 text-sm text-ink-muted"
        >
          Tidak ada cabang dipilih. Data kolaborasi, peta, dan tema akan kosong
          sampai Anda memilih minimal satu cabang.
        </p>
      ) : null}
    </section>
  );
}
