import type { Metadata } from "next";
import Link from "next/link";

import { KpiDashboard } from "@/components/dashboard/kpi-dashboard";
import { Button } from "@/components/ui/button";
import { getDashboardMap } from "@/lib/dashboard-map";
import {
  getDashboardOverview,
  getKpiFilterOptions,
  kpiPeriod,
  monthOptions,
  parseKpiFiltersFromParams,
} from "@/lib/kpi/sql";
import { getPerformanceSummary } from "@/lib/performance";
import { countReviewQueue } from "@/lib/review";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard cabang",
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

  const period = kpiPeriod(filters);
  const alignmentAllowed = !filters.stakeholderId && !filters.subTheme;
  const [overview, options, pendingCount, summary, map] = await Promise.all([
    getDashboardOverview(user, filters),
    getKpiFilterOptions(user),
    countReviewQueue(user),
    alignmentAllowed
      ? getPerformanceSummary(user, period)
      : Promise.resolve(null),
    getDashboardMap(user, {
      period,
      stakeholderId: filters.stakeholderId,
      subTheme: filters.subTheme,
    }),
  ]);

  return (
    <KpiDashboard
      overview={overview}
      role={user.role}
      options={{ ...options, months: monthOptions(filters.month) }}
      basePath="/cabang/dashboard"
      title="Dashboard cabang"
      description={`Capaian dan antrean validasi untuk ${user.scopeLabel}. Anda hanya melihat konten organisasi pada cabang ini.`}
      contentDetailBase="/cabang/konten"
      stakeholderChartTitle="Peringkat organisasi cabang"
      alignment={
        summary
          ? {
              ...summary,
              periodKey: period.key,
              periodLabel: period.label,
            }
          : null
      }
      map={map}
      headerActions={
        <Button asChild className="h-9">
          <Link href="/cabang">
            Buka SLA Check
            {pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Link>
        </Button>
      }
    />
  );
}
