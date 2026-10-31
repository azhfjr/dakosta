import type { Metadata } from "next";
import Link from "next/link";

import { KpiDashboard } from "@/components/dashboard/kpi-dashboard";
import { Button } from "@/components/ui/button";
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

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("ADMIN");
  const params = await searchParams;
  const filters = parseKpiFiltersFromParams(params);

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
      headerActions={
        <Button asChild className="h-9">
          <Link href="/admin/validasi">Buka antrean validasi</Link>
        </Button>
      }
    />
  );
}
