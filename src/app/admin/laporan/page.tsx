import type { Metadata } from "next";

import { PerformanceTable } from "@/components/performance/performance-table";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { formatDateTimeId } from "@/lib/dates";
import {
  getPerformanceTable,
  parsePerformanceFilters,
} from "@/lib/performance";
import { canCapability } from "@/lib/rbac";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Kinerja",
};

export const dynamic = "force-dynamic";

export default async function AdminPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("ADMIN");
  const params = await searchParams;
  const filters = parsePerformanceFilters(params);
  const table = await getPerformanceTable(user, filters);

  return (
    <PageContainer>
      <PageHeader
        title="Kinerja"
        description="Pencapaian approved per instansi untuk seluruh wilayah. Realisasi dihitung dari konten berstatus disetujui dengan tanggal approval final dalam periode."
        meta={`Diperbarui ${formatDateTimeId(table.generatedAt)} WIB`}
      />
      <PerformanceTable
        table={table}
        basePath="/admin/laporan"
        scopeLabel={user.scopeLabel}
        canExport={canCapability(user, "performance:export")}
        showBranchFilter
      />
    </PageContainer>
  );
}
