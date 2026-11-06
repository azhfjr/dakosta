import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { KpiDashboard } from "@/components/dashboard/kpi-dashboard";
import { PageHeader } from "@/components/shell/page-header";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { Button } from "@/components/ui/button";
import { getDashboardMap } from "@/lib/dashboard-map";
import { redirectDashboardView } from "@/lib/dashboard/view";
import { formatDateTimeId } from "@/lib/dates";
import {
  getDashboardOverview,
  getKpiFilterOptions,
  kpiPeriod,
  monthOptions,
  parseKpiFiltersFromParams,
} from "@/lib/kpi/sql";
import { getPerformanceSummary } from "@/lib/performance";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard wilayah",
};

export const dynamic = "force-dynamic";

type DashboardUser = Awaited<ReturnType<typeof requireRole>>;

export default async function RegionalHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("REGIONAL_ADMIN");
  const params = await searchParams;
  const filters = parseKpiFiltersFromParams(params);
  redirectDashboardView("/wilayah/dashboard", params);
  const description = `Capaian konten disetujui dan antrean validasi untuk ${user.scopeLabel}. Wilayah bersifat baca-saja: keputusan tetap dilakukan admin cabang.`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard wilayah"
        description={description}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <Button asChild className="h-9">
            <Link href="/wilayah/kinerja">Buka kinerja wilayah</Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton label="Memuat dasbor…" />}>
        <RegionalHomeBody
          user={user}
          filters={filters}
          description={description}
        />
      </Suspense>
    </div>
  );
}

async function RegionalHomeBody({
  user,
  filters,
  description,
}: {
  user: DashboardUser;
  filters: ReturnType<typeof parseKpiFiltersFromParams>;
  description: string;
}) {
  const period = kpiPeriod(filters);
  const alignmentAllowed = !filters.stakeholderId && !filters.subTheme;
  const [overview, options, summary, map] = await Promise.all([
    getDashboardOverview(user, filters),
    getKpiFilterOptions(user),
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
      basePath="/wilayah/dashboard"
      title="Dashboard wilayah"
      description={description}
      contentDetailBase="/wilayah/konten"
      stakeholderChartTitle="Peringkat organisasi"
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
      hideHeader
    />
  );
}
