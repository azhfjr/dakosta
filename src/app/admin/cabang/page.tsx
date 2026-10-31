import type { Metadata } from "next";

import { BranchTable } from "@/components/hierarchy/branch-table";
import { BranchEditor } from "@/components/hierarchy/hierarchy-editors";
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
  const raw = params.regionId;
  const regionId = Array.isArray(raw) ? raw[0] : raw;

  const [all, hierarchy] = await Promise.all([
    listBranches(admin.scope),
    listHierarchyOptions(),
  ]);
  const branches =
    regionId && /^[0-9a-f-]{36}$/i.test(regionId)
      ? all.filter((branch) => branch.regionId === regionId)
      : all;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Cabang
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Cabang pengelola review per wilayah. Admin Cabang hanya dapat memutuskan
            konten organisasi pada cabangnya.
          </p>
        </div>
        <BranchEditor regions={hierarchy.regions} readOnly={admin.isDemo} />
      </header>

      {admin.isDemo ? (
        <p className="rounded-xl border border-brand-blue-500/25 bg-brand-blue-100/40 px-4 py-3 text-sm text-brand-blue-900">
          Mode demo: perubahan wilayah, cabang, dan organisasi dinonaktifkan.
        </p>
      ) : null}

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
