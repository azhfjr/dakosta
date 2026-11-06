import type { Metadata } from "next";

import { BranchTable } from "@/components/hierarchy/branch-table";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { listBranches } from "@/lib/hierarchy";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Cabang wilayah",
};

export const dynamic = "force-dynamic";

export default async function RegionalBranchesPage() {
  const user = await requireRole("REGIONAL_ADMIN");
  const branches = await listBranches(user.scope);

  return (
    <PageContainer>
      <PageHeader
        title="Cabang"
        description={`Daftar cabang pada ${user.scopeLabel} beserta jumlah organisasi, Faskes, konten, dan reviewer cabang.`}
      />
      <BranchTable
        branches={branches}
        organizationBase="/wilayah/organisasi"
        showRegion={false}
      />
    </PageContainer>
  );
}
