import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { SlaAnalyticsView } from "@/components/sla/sla-analytics";
import { SlaQueue, type SlaTabKey } from "@/components/sla/sla-queue";
import { Button } from "@/components/ui/button";
import { getSlaAnalytics, parseSlaFilters } from "@/lib/analytics/sla";
import { formatDateTimeId } from "@/lib/dates";
import { getFilterOptions } from "@/lib/filters/options";
import { firstParam } from "@/lib/filters/query";
import { listReviewQueue } from "@/lib/review";
import { requireRole } from "@/lib/session";
import { getActiveSlaPolicy } from "@/lib/sla";

export const metadata: Metadata = {
  title: "SLA wilayah",
};

export const dynamic = "force-dynamic";

function parseStatus(value: string | undefined): SlaTabKey {
  return value === "SUBMITTED" ? value : "ALL";
}

export default async function RegionalSlaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("REGIONAL_ADMIN");
  const params = await searchParams;
  const status = parseStatus(firstParam(params, "status"));
  const filters = parseSlaFilters(params);

  const [queue, policy, options, analytics] = await Promise.all([
    listReviewQueue(user, {
      status,
      orgType: filters.orgType ?? undefined,
      mainTheme: filters.mainTheme ?? undefined,
      subTheme: filters.subTheme ?? undefined,
      period: filters.period,
      search: filters.search || undefined,
      page: filters.page,
      pageSize: 15,
    }),
    getActiveSlaPolicy(),
    getFilterOptions(user),
    getSlaAnalytics(user, filters),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="SLA wilayah"
        description={`Pantau antrean, usia, dan status keputusan konten di ${user.scopeLabel}. Kedeputian bersifat baca-saja: keputusan tetap dilakukan Admin Cabang.`}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <>
            <Button asChild variant="outline" className="h-10 sm:h-9">
              <Link href="/wilayah/dashboard">Lihat dashboard</Link>
            </Button>
            <Button asChild className="h-10 sm:h-9">
              <Link href="/wilayah/kinerja">Lihat kinerja</Link>
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <SlaAnalyticsView analytics={analytics} />
        <SlaQueue
          queue={queue}
          policy={policy}
          detailBase="/wilayah/konten"
          canDecide={false}
          basePath="/wilayah"
          search={filters.search || undefined}
          status={status}
          orgType={filters.orgType ?? undefined}
          mainTheme={filters.mainTheme ?? undefined}
          subTheme={filters.subTheme ?? undefined}
          period={filters.period}
          options={{
            orgTypes: options.orgTypes,
            mainThemes: options.mainThemes,
            subThemes: options.subThemes,
            periods: options.periods,
          }}
          scopeLabel={user.scopeLabel}
          readOnlyNote="Mode pantau: tindakan approval/revisi hanya untuk Admin Cabang."
        />
      </div>
    </PageContainer>
  );
}
