import type { Metadata } from "next";

import { OrganizationEditor } from "@/components/hierarchy/hierarchy-editors";
import { OrganizationTable } from "@/components/hierarchy/organization-table";
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
  const raw = params.branchId;
  const branchId = Array.isArray(raw) ? raw[0] : raw;

  const [organizations, hierarchy] = await Promise.all([
    listOrganizations(admin.scope, {
      branchId:
        branchId && /^[0-9a-f-]{36}$/i.test(branchId) ? branchId : undefined,
    }),
    listHierarchyOptions(),
  ]);

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

      <OrganizationTable
        organizations={organizations}
        contentBase="/admin/konten"
        editorBranches={hierarchy.branches}
        readOnly={admin.isDemo}
      />
    </div>
  );
}
