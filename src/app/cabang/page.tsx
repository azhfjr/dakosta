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
import { countReviewQueue } from "@/lib/review";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Ringkasan cabang",
};

export const dynamic = "force-dynamic";

export default async function BranchHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("BRANCH_ADMIN");
  const params = await searchParams;
  const filters = parseKpiFiltersFromParams(params);

  const [overview, options, pendingCount] = await Promise.all([
    getDashboardOverview(user, filters),
    getKpiFilterOptions(user),
    countReviewQueue(user),
  ]);

  return (
    <KpiDashboard
      overview={overview}
      role={user.role}
      options={{ ...options, months: monthOptions(filters.month) }}
      basePath="/cabang"
      title="Ringkasan cabang"
      description={`Capaian dan antrean validasi untuk ${user.scopeLabel}. Anda hanya melihat konten organisasi pada cabang ini.`}
      contentDetailBase="/cabang/konten"
      stakeholderChartTitle="Peringkat organisasi cabang"
      headerActions={
        <Button asChild className="h-9">
          <Link href="/cabang/review">
            Buka antrean review
            {pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Link>
        </Button>
      }
    />
  );
}
