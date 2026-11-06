import type { Metadata } from "next";

import { BranchTable } from "@/components/hierarchy/branch-table";
import { BranchEditor } from "@/components/hierarchy/hierarchy-editors";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { getFilterOptions } from "@/lib/filters/options";
import { firstParam, parseFilterUuid } from "@/lib/filters/query";
import { listBranches } from "@/lib/hierarchy";
import { listHierarchyOptions } from "@/lib/hierarchy-admin";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Cabang",
};

export const dynamic = "force-dynamic";

export default async function AdminBranchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;
  const regionId = parseFilterUuid(firstParam(params, "regionId"));

  const [all, hierarchy, options] = await Promise.all([
    listBranches(admin.scope),
    listHierarchyOptions(),
    getFilterOptions(admin),
  ]);
  const branches = regionId
    ? all.filter((branch) => branch.regionId === regionId)
    : all;

  const filterFields: FilterField[] = [
    {
      kind: "select",
      name: "regionId",
      label: "Wilayah",
      value: regionId ?? "",
      options: options.regions,
      allLabel: "Semua wilayah",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Cabang
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Cabang pengelola review per wilayah. Admin Cabang hanya dapat
            memutuskan konten organisasi pada cabangnya.
          </p>
        </div>
        <BranchEditor regions={hierarchy.regions} readOnly={admin.isDemo} />
      </header>

      {admin.isDemo ? (
        <p className="rounded-xl border border-brand-blue-500/25 bg-brand-blue-100/40 px-4 py-3 text-sm text-brand-blue-900">
          Mode demo: perubahan wilayah, cabang, dan organisasi dinonaktifkan.
        </p>
      ) : null}

      <FilterBar
        action="/admin/cabang"
        label="Filter cabang"
        idPrefix="cabang"
        resetHref="/admin/cabang"
        fields={filterFields}
        columns={2}
        summary={`${branches.length} cabang ditampilkan.`}
      />

      <BranchTable
        branches={branches}
        organizationBase="/admin/organisasi"
        showRegion
        editorRegions={hierarchy.regions}
        readOnly={admin.isDemo}
      />
    </div>
  );
}
