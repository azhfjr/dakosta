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
  title: "Ringkasan wilayah",
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
  const description = `Capaian konten disetujui dan antrean validasi untuk ${user.scopeLabel}. Wilayah bersifat baca-saja: keputusan tetap dilakukan admin cabang.`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan wilayah"
        description={description}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <Button asChild className="h-9">
            <Link href="/wilayah/analitik">Buka analitik wilayah</Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton label="Memuat dasbor…" />}>
        <RegionalHomeBody user={user} filters={filters} description={description} />
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
      description={description}
      contentDetailBase="/wilayah/konten"
      stakeholderChartTitle="Peringkat organisasi"
      hideHeader
    />
  );
}
