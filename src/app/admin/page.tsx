import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { KpiDashboard } from "@/components/dashboard/kpi-dashboard";
import { PageHeader } from "@/components/shell/page-header";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { Button } from "@/components/ui/button";
import { formatDateTimeId } from "@/lib/dates";
import {
  getDashboardOverview,
  getKpiFilterOptions,
  monthOptions,
  parseKpiFiltersFromParams,
} from "@/lib/kpi/sql";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Ringkasan admin",
};

export const dynamic = "force-dynamic";

type DashboardUser = Awaited<ReturnType<typeof requireRole>>;

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("ADMIN");
  const params = await searchParams;
  const filters = parseKpiFiltersFromParams(params);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan"
        description="Capaian periode yang hanya dihitung dari konten disetujui, antrean validasi, dan kualitas keputusan admin."
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <Button asChild className="h-9">
            <Link href="/admin/validasi">Buka antrean validasi</Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton label="Memuat dasbor…" />}>
        <AdminHomeBody user={user} filters={filters} />
      </Suspense>
    </div>
  );
}

async function AdminHomeBody({
  user,
  filters,
}: {
  user: DashboardUser;
  filters: ReturnType<typeof parseKpiFiltersFromParams>;
}) {
  const [overview, options] = await Promise.all([
    getDashboardOverview(user, filters),
    getKpiFilterOptions(user),
  ]);

  return (
    <KpiDashboard
      overview={overview}
      role={user.role}
      options={{ ...options, months: monthOptions(filters.month) }}
      basePath="/admin"
      title="Ringkasan"
      description="Capaian periode yang hanya dihitung dari konten disetujui, antrean validasi, dan kualitas keputusan admin."
      contentDetailBase="/admin/validasi"
      stakeholderChartTitle="Peringkat stakeholder"
      hideHeader
    />
  );
}
