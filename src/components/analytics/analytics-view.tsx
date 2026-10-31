import {
  BadgeCheck,
  Building2,
  Clock3,
  Gauge,
  Percent,
  Target as TargetIcon,
} from "lucide-react";

import {
  AnalyticsFilterBar,
  type AnalyticsFilterState,
} from "@/components/analytics/analytics-filter-bar";
import { AnalyticsContentTable } from "@/components/analytics/analytics-content-table";
import { DeferredAnalyticsCharts } from "@/components/charts/analytics-charts-lazy";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/shell/page-header";
import type { AnalyticsContentPage, AnalyticsContentFilters } from "@/lib/analytics/content-table";
import type {
  AgingBucket,
  BenchmarkRow,
  ContentMixPoint,
  EdufastMonth,
  FunnelStage,
  NamedSlice,
  RankingRow,
  SlaRow,
  SourceBreakdownRow,
  StakeholderContext,
  ThemeMatrixRow,
} from "@/lib/analytics/charts";
import type { AnalyticsSourceOption } from "@/lib/analytics/source";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { targetSourceLabel, type DashboardOverview, type TargetSource } from "@/lib/kpi/formulas";
import type { TargetOverview } from "@/lib/targets";

export type AnalyticsTargetSummary = {
  value: number;
  target: number | null;
  achievement: number | null;
  source: TargetSource | null;
};

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${formatNumberId(value)}%`;
}

function formatDays(value: number | null): string {
  return value === null ? "N/A" : `${formatNumberId(value)} hari`;
}

export function AnalyticsView({
  title,
  description,
  eyebrow,
  action,
  detailBase,
  role,
  filters,
  overview,
  contentFilters,
  content,
  sourceOptions,
  stakeholders,
  themes,
  mix,
  themeRows,
  sla,
  aging,
  funnel,
  rankings,
  sources,
  edufast,
  platforms,
  benchmarks,
  targets,
  context,
  target,
  rankingLabel,
  showStakeholder,
  showAging,
  showEdufast,
  showPlatforms,
  showBenchmarks,
  showSources,
  showOrganization,
  hideHeader,
  updatedAt,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action: string;
  detailBase: string;
  role: "MASTER_ADMIN" | "REGIONAL_ADMIN" | "BRANCH_ADMIN" | "CLIENT";
  filters: AnalyticsFilterState;
  overview: DashboardOverview;
  contentFilters: AnalyticsContentFilters;
  content: AnalyticsContentPage;
  sourceOptions: AnalyticsSourceOption[];
  stakeholders?: Array<{ id: string; name: string }>;
  themes?: Array<{ id: string; name: string }>;
  mix: ContentMixPoint[];
  themeRows: ThemeMatrixRow[];
  sla: SlaRow[];
  aging: AgingBucket[];
  funnel: FunnelStage[];
  rankings: RankingRow[];
  sources: SourceBreakdownRow[];
  edufast: EdufastMonth[];
  platforms: NamedSlice[];
  benchmarks: BenchmarkRow[];
  targets: TargetOverview;
  context: StakeholderContext | null;
  target?: AnalyticsTargetSummary;
  rankingLabel?: string;
  showStakeholder?: boolean;
  showAging?: boolean;
  showEdufast?: boolean;
  showPlatforms?: boolean;
  showBenchmarks?: boolean;
  showSources?: boolean;
  showOrganization?: boolean;
  /** Header dirender oleh page agar bisa streaming sebelum data siap. */
  hideHeader?: boolean;
  updatedAt: Date;
}) {
  const resolvedTarget: AnalyticsTargetSummary = target ?? {
    value: overview.approved.value,
    target: overview.approved.target,
    achievement: overview.approved.achievement,
    source: overview.approved.targetSource,
  };
  const isClient = role === "CLIENT";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {hideHeader ? null : (
        <PageHeader
          title={title}
          description={description}
          eyebrow={eyebrow}
          meta={`Diperbarui ${formatDateTimeId(updatedAt)} WIB`}
        />
      )}

      {context ? (
        <section
          aria-label="Konteks organisasi"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-sm sm:px-5"
        >
          <span className="inline-flex items-center gap-2 font-medium text-foreground">
            <Building2 className="size-4 text-brand-green-700" aria-hidden />
            {context.name}
          </span>
          <span className="text-xs text-ink-muted">
            {context.source === "FASKES_FKTP" || context.source === "FASKES_FKRTL"
              ? `Faskes ${context.faskesClass ?? ""}`
              : context.source === "PEMDA"
                ? "Pemda"
                : "Stakeholder/Mitra"}
          </span>
          <span className="text-xs text-ink-muted">
            {context.branchName ?? "Tanpa cabang"}
            {context.regionName ? ` · ${context.regionName}` : ""}
          </span>
          {context.serviceArea ? (
            <span className="text-xs text-ink-muted">{context.serviceArea}</span>
          ) : null}
        </section>
      ) : null}

      <AnalyticsFilterBar
        action={action}
        filters={filters}
        sourceOptions={sourceOptions}
        stakeholders={stakeholders}
        themes={themes}
        showStakeholder={showStakeholder ?? !isClient}
        periodLabel={overview.period.label}
        attributionLabel={overview.period.attributionLabel}
      />

      <section
        aria-label="Indikator utama analitik"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Konten disetujui"
          value={formatNumberId(resolvedTarget.value)}
          hint={
            resolvedTarget.target === null
              ? "Target belum ditetapkan"
              : `Target ${formatNumberId(resolvedTarget.target)} · ${targetSourceLabel(resolvedTarget.source)}`
          }
          icon={BadgeCheck}
          tone="green"
        />
        <StatCard
          label="Capaian target"
          value={formatPercent(resolvedTarget.achievement)}
          hint={
            resolvedTarget.target === null
              ? "Tidak ada target pada cakupan filter ini"
              : resolvedTarget.target === 0
                ? "Target 0 tidak dapat dihitung"
                : `${formatNumberId(targets.month ? targets.rows.length : 0)} cakupan target aktif`
          }
          icon={Gauge}
          tone={
            resolvedTarget.achievement !== null && resolvedTarget.achievement >= 100
              ? "green"
              : "amber"
          }
        />
        <StatCard
          label="Tingkat persetujuan"
          value={formatPercent(overview.approvalRate)}
          hint={`${formatNumberId(overview.approvedDecisions)} setuju dari ${formatNumberId(overview.reviewed)} keputusan pada periode`}
          icon={Percent}
          tone="teal"
        />
        <StatCard
          label="Median waktu validasi"
          value={formatDays(overview.leadTimeMedianDays)}
          hint={`${formatNumberId(overview.approvalSamples)} sampel keputusan disetujui`}
          icon={Clock3}
          tone="blue"
        />
      </section>

      {resolvedTarget.target === null ? (
        <section
          aria-label="Status target"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-3 text-sm text-ink-muted sm:px-5"
        >
          <TargetIcon className="size-4" aria-hidden />
          Target periode ini belum ditetapkan untuk cakupan Anda. Master Admin
          dapat menetapkan atau menyinkronkan target pada menu Target periode.
        </section>
      ) : null}

      <DeferredAnalyticsCharts
        mix={mix}
        themes={themeRows}
        sla={sla}
        aging={aging}
        funnel={funnel}
        rankings={rankings}
        rankingLabel={rankingLabel}
        sources={sources}
        edufast={edufast}
        platforms={platforms}
        benchmarks={benchmarks}
        showAging={showAging ?? !isClient}
        showEdufast={showEdufast ?? true}
        showPlatforms={showPlatforms ?? isClient}
        showBenchmarks={showBenchmarks ?? isClient}
        showSources={showSources ?? !isClient}
      />

      <AnalyticsContentTable
        action={action}
        detailBase={detailBase}
        filters={contentFilters}
        data={content}
        sourceOptions={sourceOptions}
        showOrganization={showOrganization ?? !isClient}
      />
    </div>
  );
}
