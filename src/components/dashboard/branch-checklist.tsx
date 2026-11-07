"use client";

import { useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, MapPin } from "lucide-react";

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
  const [pending, startTransition] = useTransition();
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
    const href = branchSelectionHref(basePath, params, next, { hash });
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

  return (
    <section
      id="pilih-cabang"
      aria-labelledby="pilih-cabang-judul"
      aria-busy={pending}
      className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="pilih-cabang-judul"
            className="text-base font-semibold text-foreground"
          >
            Cabang
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Pilihan ini berlaku untuk kolaborasi, peta, dan tema konten.
          </p>
        </div>
        <p className="text-xs text-ink-muted" aria-live="polite">
          <span className="font-semibold text-foreground tabular">
            {selectedCount} dari {branchCount}
          </span>{" "}
          cabang dipilih
        </p>
      </div>

      {branchCount === 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-status-review/30 bg-status-review/5 p-4">
          <AlertCircle
            className="mt-0.5 size-5 shrink-0 text-status-review"
            aria-hidden
          />
          <p className="text-sm text-ink-muted">
            Tidak ada cabang dalam cakupan Anda, sehingga filter cabang tidak
            tersedia. Capaian tetap mengikuti cakupan organisasi Anda.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/50 px-3 py-2.5">
            <label
              htmlFor="pilih-semua-cabang"
              className="flex items-center gap-2 text-sm font-semibold text-foreground"
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
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPin className="size-3.5" aria-hidden />
              {groups.length} wilayah
            </span>
          </div>

          <div
            className="mt-3 max-h-[320px] space-y-3 overflow-y-auto overscroll-contain pr-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
                  className="rounded-lg border border-border/70 p-3"
                >
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
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
                  <ul className="mt-2 space-y-1.5 pl-6">
                    {group.branches.map((branch) => (
                      <li key={branch.id}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                          <TriStateCheckbox
                            id={`cabang-${branch.id}`}
                            checked={selected.has(branch.id)}
                            disabled={pending}
                            onChange={(checked) => onToggle(branch.id, checked)}
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

          {selectedCount === 0 ? (
            <p
              role="status"
              className="mt-3 rounded-md border border-status-review/30 bg-status-review/5 px-3 py-2 text-sm text-ink-muted"
            >
              Tidak ada cabang dipilih. Data kolaborasi, peta, dan tema akan
              kosong sampai Anda memilih minimal satu cabang.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
