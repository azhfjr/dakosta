import type { Metadata } from "next";

import { BranchTable } from "@/components/hierarchy/branch-table";
import { BranchEditor } from "@/components/hierarchy/hierarchy-editors";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
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
    <PageContainer>
      <PageHeader
        title="Cabang"
        description="Cabang pengelola review per wilayah. Admin Cabang hanya dapat memutuskan konten organisasi pada cabangnya."
        actions={
          <BranchEditor regions={hierarchy.regions} readOnly={admin.isDemo} />
        }
      />

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
    </PageContainer>
  );
}
