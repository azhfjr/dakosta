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
import {
  getAnalyticsSourceOptions,
  parseOrgSources,
} from "@/lib/analytics/source";
import { formatDateTimeId } from "@/lib/dates";
import {
  getDashboardOverview,
  getKpiFilterOptions,
  parseKpiFiltersFromParams,
} from "@/lib/kpi/sql";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Analitik",
};

export const dynamic = "force-dynamic";

type AnalyticsUser = Awaited<ReturnType<typeof requireRole>>;

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("ADMIN");
  const params = await searchParams;
  const filters = {
    ...parseKpiFiltersFromParams(params),
    sources: parseOrgSources(params),
  };
  const contentFilters = parseAnalyticsContentFilters(params);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title="Analitik nasional"
        eyebrow="Master Admin"
        description="Analisis capaian, komposisi konten, SLA keputusan, dan antrean validasi seluruh sumber input. Angka konten disetujui mengikuti dasar tanggal yang dipilih."
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
      />
      <Suspense fallback={<PageSkeleton label="Memuat data analitik…" />}>
        <AdminAnalyticsBody
          user={user}
          filters={filters}
          contentFilters={contentFilters}
        />
      </Suspense>
    </div>
  );
}

async function AdminAnalyticsBody({
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
  const [overview, options, sourceOptions, bundle, content] = await Promise.all(
    [
      getDashboardOverview(user, filters),
      getKpiFilterOptions(user),
      getAnalyticsSourceOptions(user),
      getAnalyticsBundle(user, filters, { rankings: "branch" }),
      listAnalyticsContents(user, contentFilters),
    ],
  );

  return (
    <AnalyticsView
      title="Analitik nasional"
      eyebrow="Master Admin"
      description="Analisis capaian, komposisi konten, SLA keputusan, dan antrean validasi seluruh sumber input. Angka konten disetujui mengikuti dasar tanggal yang dipilih."
      action="/admin/analitik"
      detailBase="/admin/validasi"
      role="MASTER_ADMIN"
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
      rankingLabel="Peringkat cabang"
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
