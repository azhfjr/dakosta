import type { Metadata } from "next";

import { BranchTable } from "@/components/hierarchy/branch-table";
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
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cabang
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Daftar cabang pada {user.scopeLabel} beserta jumlah organisasi,
          Faskes, konten, dan reviewer cabang.
        </p>
      </header>
      <BranchTable
        branches={branches}
        organizationBase="/wilayah/organisasi"
        showRegion={false}
      />
    </div>
  );
}
