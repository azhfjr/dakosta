import type { Metadata } from "next";

import { OrganizationEditor } from "@/components/hierarchy/hierarchy-editors";
import { OrganizationTable } from "@/components/hierarchy/organization-table";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { getFilterOptions } from "@/lib/filters/options";
import { firstParam, parseFilterUuid } from "@/lib/filters/query";
import { listOrganizations } from "@/lib/hierarchy";
import { listHierarchyOptions } from "@/lib/hierarchy-admin";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Organisasi",
};

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;
  const branchId = parseFilterUuid(firstParam(params, "branchId"));

  const [organizations, hierarchy, options] = await Promise.all([
    listOrganizations(admin.scope, { branchId: branchId ?? undefined }),
    listHierarchyOptions(),
    getFilterOptions(admin),
  ]);

  const filterFields: FilterField[] = [
    {
      kind: "select",
      name: "branchId",
      label: "Cabang",
      value: branchId ?? "",
      options: options.branches,
      allLabel: "Semua cabang",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Organisasi
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Direktori Faskes FKTP/FKRTL, pemerintah daerah, dan organisasi lain.
            Kode Faskes ternormalisasi dan unik untuk organisasi aktif.
          </p>
        </div>
        <OrganizationEditor
          branches={hierarchy.branches}
          readOnly={admin.isDemo}
        />
      </header>

      {admin.isDemo ? (
        <p className="rounded-xl border border-brand-blue-500/25 bg-brand-blue-100/40 px-4 py-3 text-sm text-brand-blue-900">
          Mode demo: perubahan wilayah, cabang, dan organisasi dinonaktifkan.
        </p>
      ) : null}

      <FilterBar
        action="/admin/organisasi"
        label="Filter organisasi"
        idPrefix="organisasi"
        resetHref="/admin/organisasi"
        fields={filterFields}
        columns={2}
        summary={`${organizations.length} organisasi ditampilkan.`}
      />

      <OrganizationTable
        organizations={organizations}
        contentBase="/admin/konten"
        editorBranches={hierarchy.branches}
        readOnly={admin.isDemo}
      />
    </div>
  );
}
