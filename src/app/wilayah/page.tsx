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
  title: "Ringkasan wilayah",
};

export const dynamic = "force-dynamic";

export default async function RegionalHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("REGIONAL_ADMIN");
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
      basePath="/wilayah"
      title="Ringkasan wilayah"
      description={`Capaian konten disetujui dan antrean validasi untuk ${user.scopeLabel}. Wilayah bersifat baca-saja: keputusan tetap dilakukan admin cabang.`}
      contentDetailBase="/wilayah/konten"
      stakeholderChartTitle="Peringkat organisasi"
      headerActions={
        <Button asChild className="h-9">
          <Link href="/wilayah/analitik">Buka analitik wilayah</Link>
        </Button>
      }
    />
  );
}
