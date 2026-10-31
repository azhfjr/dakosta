import type { Metadata } from "next";

import { OrganizationTable } from "@/components/hierarchy/organization-table";
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
  const raw = params.branchId;
  const branchId = Array.isArray(raw) ? raw[0] : raw;

  const organizations = await listOrganizations(user.scope, {
    branchId: branchId && /^[0-9a-f-]{36}$/i.test(branchId) ? branchId : undefined,
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Organisasi</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Direktori Faskes, pemerintah daerah, dan organisasi lain pada {user.scopeLabel}.
          Kode Faskes ternormalisasi dan unik per jenis.
        </p>
      </header>
      <OrganizationTable organizations={organizations} contentBase="/wilayah/konten" />
    </div>
  );
}
