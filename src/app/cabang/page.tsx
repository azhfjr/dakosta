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
  title: "SLA cabang",
};

export const dynamic = "force-dynamic";

function parseStatus(value: string | undefined): SlaTabKey {
  return value === "SUBMITTED" ? value : "ALL";
}

export default async function BranchSlaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("BRANCH_ADMIN");
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
        title="SLA cabang"
        description={`Antrean konten dari instansi di ${user.scopeLabel}. Anda dapat meninjau dan memutuskan konten cabang sendiri; SLA berakhir pada approval final.`}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <>
            <Button asChild variant="outline" className="h-10 sm:h-9">
              <Link href="/cabang/dashboard">Lihat dashboard</Link>
            </Button>
            <Button asChild className="h-10 sm:h-9">
              <Link href="/cabang/kinerja">Lihat kinerja</Link>
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <SlaAnalyticsView analytics={analytics} />
        <SlaQueue
          queue={queue}
          policy={policy}
          detailBase="/cabang/review"
          canDecide
          basePath="/cabang"
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
        />
      </div>
    </PageContainer>
  );
}
