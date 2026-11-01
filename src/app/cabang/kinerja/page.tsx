import type { Metadata } from "next";

import { PerformanceTable } from "@/components/performance/performance-table";
import { PageHeader } from "@/components/shell/page-header";
import { formatDateTimeId } from "@/lib/dates";
import {
  getPerformanceTable,
  parsePerformanceFilters,
} from "@/lib/performance";
import { canCapability } from "@/lib/rbac";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Kinerja cabang",
};

export const dynamic = "force-dynamic";

export default async function BranchPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("BRANCH_ADMIN");
  const params = await searchParams;
  const filters = parsePerformanceFilters(params);
  const table = await getPerformanceTable(user, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kinerja cabang"
        description={`Pencapaian approved per instansi di ${user.scopeLabel}. Target mengikuti kebijakan Master Admin; tabel, cetak, PDF, dan CSV memakai data, filter, serta otorisasi yang sama.`}
        meta={`Diperbarui ${formatDateTimeId(table.generatedAt)} WIB`}
      />
      <PerformanceTable
        table={table}
        basePath="/cabang/kinerja"
        scopeLabel={user.scopeLabel}
        canExport={canCapability(user, "performance:export")}
        showBranchFilter={false}
      />
    </div>
  );
}
