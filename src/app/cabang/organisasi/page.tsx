import type { Metadata } from "next";

import { OrganizationTable } from "@/components/hierarchy/organization-table";
import { listOrganizations } from "@/lib/hierarchy";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Organisasi cabang",
};

export const dynamic = "force-dynamic";

export default async function BranchOrganizationsPage() {
  const user = await requireRole("BRANCH_ADMIN");
  const organizations = await listOrganizations(user.scope);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Organisasi cabang
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Faskes FKTP/FKRTL dan organisasi lain di {user.scopeLabel}. Kode
          Faskes ternormalisasi dan unik.
        </p>
      </header>
      <OrganizationTable
        organizations={organizations}
        contentBase="/cabang/konten"
      />
    </div>
  );
}
