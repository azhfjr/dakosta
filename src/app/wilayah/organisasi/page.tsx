import type { Metadata } from "next";

import { OrganizationTable } from "@/components/hierarchy/organization-table";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { getFilterOptions } from "@/lib/filters/options";
import { firstParam, parseFilterUuid } from "@/lib/filters/query";
import { listOrganizations } from "@/lib/hierarchy";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Organisasi wilayah",
};

export const dynamic = "force-dynamic";

export default async function RegionalOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("REGIONAL_ADMIN");
  const params = await searchParams;
  const branchId = parseFilterUuid(firstParam(params, "branchId"));

  const [organizations, options] = await Promise.all([
    listOrganizations(user.scope, { branchId: branchId ?? undefined }),
    getFilterOptions(user),
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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Organisasi
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Direktori Faskes, pemerintah daerah, dan organisasi lain pada{" "}
          {user.scopeLabel}. Kode Faskes ternormalisasi dan unik per jenis.
        </p>
      </header>
      <FilterBar
        action="/wilayah/organisasi"
        label="Filter organisasi"
        idPrefix="organisasi-wilayah"
        resetHref="/wilayah/organisasi"
        fields={filterFields}
        columns={2}
        summary={`${organizations.length} organisasi ditampilkan.`}
      />
      <OrganizationTable
        organizations={organizations}
        contentBase="/wilayah/konten"
      />
    </div>
  );
}
