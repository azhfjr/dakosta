import type { Metadata } from "next";

import { OrganizationTable } from "@/components/hierarchy/organization-table";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
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
    <PageContainer>
      <PageHeader
        title="Organisasi cabang"
        description={`Faskes FKTP/FKRTL dan organisasi lain di ${user.scopeLabel}. Kode Faskes ternormalisasi dan unik.`}
      />
      <OrganizationTable
        organizations={organizations}
        contentBase="/cabang/konten"
      />
    </PageContainer>
  );
}
