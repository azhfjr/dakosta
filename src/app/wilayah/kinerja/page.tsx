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
  title: "Kinerja wilayah",
};

export const dynamic = "force-dynamic";

export default async function RegionalPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("REGIONAL_ADMIN");
  const params = await searchParams;
  const filters = parsePerformanceFilters(params);
  const table = await getPerformanceTable(user, filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kinerja wilayah"
        description={`Pencapaian approved per instansi di ${user.scopeLabel}. Target mengikuti kebijakan Master Admin; wilayah bersifat baca-saja dan hanya memuat instansi dalam scope Anda.`}
        meta={`Diperbarui ${formatDateTimeId(table.generatedAt)} WIB`}
      />
      <PerformanceTable
        table={table}
        basePath="/wilayah/kinerja"
        scopeLabel={user.scopeLabel}
        canExport={canCapability(user, "performance:export")}
        showBranchFilter
      />
    </div>
  );
}
