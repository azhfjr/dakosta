import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageHeader } from "@/components/shell/page-header";
import { recordAudit } from "@/lib/audit";
import {
  getAnalyticsBundle,
  resolveStakeholderTarget,
} from "@/lib/analytics/charts";
import {
  listAnalyticsContents,
  parseAnalyticsContentFilters,
} from "@/lib/analytics/content-table";
import {
  getAnalyticsSourceOptions,
  parseOrgSources,
} from "@/lib/analytics/source";
import { formatDateTimeId } from "@/lib/dates";
import { achievementPercent } from "@/lib/kpi/formulas";
import {
  getDashboardOverview,
  getKpiFilterOptions,
  parseKpiFiltersFromParams,
} from "@/lib/kpi/sql";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Analitik organisasi",
};

export const dynamic = "force-dynamic";

type AnalyticsUser = Awaited<ReturnType<typeof requireRole>>;

export default async function ClientAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("CLIENT");
  const params = await searchParams;
  const base = parseKpiFiltersFromParams(params);
  if (base.stakeholderId && !user.stakeholderIds.includes(base.stakeholderId)) {
    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "ACCESS_DENIED",
      recordType: "STAKEHOLDER",
      recordId: base.stakeholderId,
      after: {
        reason: "stakeholder_scope_mismatch",
        route: "/client/analitik",
      },
    });
    redirect("/akses-ditolak");
  }
  const filters = { ...base, sources: parseOrgSources(params) };
  const contentFilters = parseAnalyticsContentFilters(params);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title="Analitik organisasi"
        eyebrow={user.scopeLabel}
        description="Capaian dan kualitas konten organisasi Anda: target, tren, tema, kepatuhan EDUFAST, turnaround keputusan, serta pembanding cohort sejenis."
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
      />
      <Suspense fallback={<PageSkeleton label="Memuat data analitik…" />}>
        <ClientAnalyticsBody
          user={user}
          filters={filters}
          contentFilters={contentFilters}
        />
      </Suspense>
    </div>
  );
}

async function ClientAnalyticsBody({
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
      getAnalyticsBundle(user, filters),
      listAnalyticsContents(user, contentFilters),
    ],
  );

  const context = bundle.context;
  const resolved =
    user.scope.kind === "ORG"
      ? resolveStakeholderTarget(
          bundle.targets,
          user.scope.organizationId,
          filters.subTheme,
        )
      : { target: null, source: null, achievement: null, value: 0 };
  const target =
    resolved.target === null
      ? {
          value: overview.approved.value,
          target: null,
          achievement: null,
          source: null,
        }
      : {
          value: overview.approved.value,
          target: resolved.target,
          achievement: achievementPercent(
            overview.approved.value,
            resolved.target,
          ),
          source: resolved.source,
        };

  return (
    <AnalyticsView
      title="Analitik organisasi"
      eyebrow={context?.name ?? user.scopeLabel}
      description="Capaian dan kualitas konten organisasi Anda: target, tren, tema, kepatuhan EDUFAST, turnaround keputusan, serta pembanding cohort sejenis."
      action="/client/analitik"
      detailBase="/client/konten"
      role="CLIENT"
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
      sources={bundle.sources}
      edufast={bundle.edufast}
      platforms={bundle.platforms}
      benchmarks={bundle.benchmarks.rows}
      targets={bundle.targets}
      context={context}
      target={target}
      updatedAt={overview.generatedAt}
      hideHeader
      showStakeholder={false}
      showAging={false}
      showSources={false}
      showOrganization={false}
      showBenchmarks
      showPlatforms={context?.organizationType === "OTHER"}
    />
  );
}
