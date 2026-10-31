import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageHeader } from "@/components/shell/page-header";
import { getAnalyticsBundle } from "@/lib/analytics/charts";
import {
  listAnalyticsContents,
  parseAnalyticsContentFilters,
} from "@/lib/analytics/content-table";
import { getAnalyticsSourceOptions, parseOrgSources } from "@/lib/analytics/source";
import { formatDateTimeId } from "@/lib/dates";
import {
  getDashboardOverview,
  getKpiFilterOptions,
  parseKpiFiltersFromParams,
} from "@/lib/kpi/sql";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Analitik cabang",
};

export const dynamic = "force-dynamic";

type AnalyticsUser = Awaited<ReturnType<typeof requireRole>>;

export default async function BranchAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("BRANCH_ADMIN");
  const params = await searchParams;
  const filters = {
    ...parseKpiFiltersFromParams(params),
    sources: parseOrgSources(params),
  };
  const contentFilters = parseAnalyticsContentFilters(params);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title="Analitik cabang"
        eyebrow={user.scopeLabel}
        description="Analisis capaian, komposisi konten, SLA keputusan, dan umur antrean validasi organisasi di cabang Anda."
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
      />
      <Suspense fallback={<PageSkeleton label="Memuat data analitik…" />}>
        <BranchAnalyticsBody
          user={user}
          filters={filters}
          contentFilters={contentFilters}
        />
      </Suspense>
    </div>
  );
}

async function BranchAnalyticsBody({
  user,
  filters,
  contentFilters,
}: {
  user: AnalyticsUser;
  filters: ReturnType<typeof parseKpiFiltersFromParams> & {
    sources: ReturnType<typeof parseOrgSources>;
  };
  contentFilters: ReturnType<typeof parseAnalyticsContentFilters>;
}) {
  const [overview, options, sourceOptions, bundle, content] = await Promise.all([
    getDashboardOverview(user, filters),
    getKpiFilterOptions(user),
    getAnalyticsSourceOptions(user),
    getAnalyticsBundle(user, filters, { rankings: "organization" }),
    listAnalyticsContents(user, contentFilters),
  ]);

  return (
    <AnalyticsView
      title="Analitik cabang"
      eyebrow={user.scopeLabel}
      description="Analisis capaian, komposisi konten, SLA keputusan, dan umur antrean validasi organisasi di cabang Anda."
      action="/cabang/analitik"
      detailBase="/cabang/review"
      role="BRANCH_ADMIN"
      filters={filters}
      overview={overview}
      contentFilters={contentFilters}
      content={content}
      sourceOptions={sourceOptions}
      stakeholders={options.stakeholders}
      themes={options.themes}
      mix={bundle.mix}
      themeRows={bundle.themes}
      sla={bundle.sla}
      aging={bundle.aging}
      funnel={bundle.funnel}
      rankings={bundle.rankings}
      rankingLabel="Peringkat organisasi"
      sources={bundle.sources}
      edufast={bundle.edufast}
      platforms={bundle.platforms}
      benchmarks={bundle.benchmarks.rows}
      targets={bundle.targets}
      context={null}
      updatedAt={overview.generatedAt}
      hideHeader
      showAging
      showSources
    />
  );
}
