import { cache, Suspense, type ReactNode } from "react";
import { Building2 } from "lucide-react";

import { BranchChecklist } from "@/components/dashboard/branch-checklist";
import { CategoryRankingPanel } from "@/components/dashboard/category-ranking";
import {
  ContentTypePanel,
  ContentTypeTrendChart,
  ThemeTrendChart,
} from "@/components/dashboard/content-type-panel";
import { DashboardMapSection } from "@/components/dashboard/dashboard-map";
import {
  DashboardChartSkeleton,
  DashboardErrorState,
  DashboardSectionBoundary,
  DashboardSectionSkeleton,
} from "@/components/dashboard/dashboard-states";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import {
  RankedBarChart,
  type RankedBarRow,
} from "@/components/dashboard/ranked-bar-chart";
import {
  BranchScopeScorecards,
  StakeholderScorecards,
  SummaryScorecards,
} from "@/components/dashboard/scorecards";
import { ThemePanel } from "@/components/dashboard/theme-panel";
import {
  getDashboardFiltered,
  getDashboardSummary,
} from "@/lib/analytics/dashboard-overview";
import {
  DASHBOARD_CATEGORIES,
  type DashboardCategory,
  type DashboardFiltered,
  type DashboardInstitutionChart,
  type DashboardSummary,
} from "@/lib/dashboard/types";
import {
  dashboardSections,
  dashboardVariant,
  selectionForDashboard,
  type DashboardVariant,
} from "@/lib/dashboard/variant";
import type { BranchSelection } from "@/lib/filters/branch-selection";
import type { FilterParams } from "@/lib/filters/query";
import { formatNumberId } from "@/lib/dates";
import type { SessionUser } from "@/lib/session";

const CATEGORY_ANCHORS: Record<DashboardCategory, string> = {
  FKRTL: "fkrtl",
  FKTP: "fktp",
  PEMDA: "pemda",
  STAKEHOLDER: "stakeholder",
};

// Request-scoped dedupe: the summary and filtered sections stream separately,
// but a single request must still issue one query per snapshot.
const summaryForRequest = cache((user: SessionUser) =>
  getDashboardSummary(user),
);
const filteredForRequest = cache(
  (user: SessionUser, mode: BranchSelection["mode"], idsKey: string) =>
    getDashboardFiltered(user, {
      mode,
      ids: idsKey ? idsKey.split(",") : [],
    }),
);

function selectionKey(selection: BranchSelection): string {
  return selection.ids.join(",");
}

function scopeDescription(variant: DashboardVariant): string {
  if (variant === "branch") return "cakupan cabang Anda";
  if (variant === "stakeholder") return "organisasi Anda";
  return "cabang terpilih";
}

export function DashboardOverview({
  user,
  basePath,
  params,
  styleUrl,
}: {
  user: SessionUser;
  basePath: string;
  params: FilterParams;
  styleUrl: string;
}) {
  const variant = dashboardVariant(user.role);
  const sections = dashboardSections(variant);
  const showCollaboration = sections.includes("kolaborasi");

  return (
    <div className="space-y-5 sm:space-y-6">
      <Suspense
        fallback={
          <DashboardSectionSkeleton
            label="Memuat ringkasan…"
            rows={variant === "stakeholder" ? 3 : 6}
          />
        }
      >
        <SummarySection user={user} params={params} variant={variant} />
      </Suspense>
      {sections.includes("konten-per-cabang") ? (
        <Suspense
          fallback={
            <DashboardChartSkeleton label="Memuat konten per cabang…" />
          }
        >
          <BranchChartSection user={user} />
        </Suspense>
      ) : null}
      {sections.includes("konten-per-institusi") ? (
        <Suspense
          fallback={
            <DashboardChartSkeleton label="Memuat konten per institusi…" />
          }
        >
          <InstitutionChartSection
            user={user}
            params={params}
            variant={variant}
          />
        </Suspense>
      ) : null}
      {sections.includes("jenis-konten") ? (
        <Suspense
          fallback={<DashboardChartSkeleton label="Memuat jenis konten…" />}
        >
          <ContentTypeSection user={user} params={params} variant={variant} />
        </Suspense>
      ) : null}
      {sections.includes("tren-bulanan") ? (
        <Suspense
          fallback={<DashboardChartSkeleton label="Memuat tren bulanan…" />}
        >
          <TrendSection user={user} params={params} variant={variant} />
        </Suspense>
      ) : null}
      {sections.includes("tren-jenis-konten") ? (
        <Suspense
          fallback={
            <DashboardChartSkeleton label="Memuat tren jenis konten…" />
          }
        >
          <TypeTrendSection user={user} params={params} variant={variant} />
        </Suspense>
      ) : null}
      {sections.includes("tren-tema") ? (
        <Suspense
          fallback={<DashboardChartSkeleton label="Memuat tren tema…" />}
        >
          <ThemeTrendSection user={user} params={params} variant={variant} />
        </Suspense>
      ) : null}
      {showCollaboration ? (
        <Suspense
          fallback={
            <DashboardSectionSkeleton label="Memuat kolaborasi…" rows={4} />
          }
        >
          <CollaborationSection
            user={user}
            basePath={basePath}
            params={params}
            styleUrl={styleUrl}
            variant={variant}
          />
        </Suspense>
      ) : null}
      <Suspense
        fallback={
          <DashboardSectionSkeleton label="Memuat tema konten…" rows={2} />
        }
      >
        <ThemeSection user={user} params={params} variant={variant} />
      </Suspense>
    </div>
  );
}

async function loadFiltered(
  user: SessionUser,
  params: FilterParams,
  variant: DashboardVariant,
): Promise<
  | { ok: true; summary: DashboardSummary; filtered: DashboardFiltered }
  | { ok: false }
> {
  try {
    const summary = await summaryForRequest(user);
    const selection = selectionForDashboard(
      variant,
      params,
      summary.branches.map((branch) => branch.id),
    );
    const filtered = await filteredForRequest(
      user,
      selection.mode,
      selectionKey(selection),
    );
    return { ok: true, summary, filtered };
  } catch (error) {
    console.error("[dashboard] data terfilter gagal dimuat", error);
    return { ok: false };
  }
}

async function SummarySection({
  user,
  params,
  variant,
}: {
  user: SessionUser;
  params: FilterParams;
  variant: DashboardVariant;
}) {
  let summary: DashboardSummary;
  try {
    summary = await summaryForRequest(user);
  } catch (error) {
    console.error("[dashboard] ringkasan gagal dimuat", error);
    return (
      <DashboardErrorState
        title="Ringkasan belum dapat dimuat"
        description="Angka ringkasan tidak tersedia saat ini. Coba lagi tanpa mengubah filter."
      />
    );
  }

  const needsFiltered = variant === "branch" || variant === "stakeholder";
  const result = needsFiltered
    ? await loadFiltered(user, params, variant)
    : null;
  if (result && !result.ok) {
    return (
      <DashboardErrorState
        title="Ringkasan belum dapat dimuat"
        description="Angka ringkasan tidak tersedia saat ini. Coba lagi tanpa mengubah filter."
      />
    );
  }
  const filtered = result?.ok ? result.filtered : null;

  return (
    <DashboardSectionBoundary
      title="Ringkasan gagal ditampilkan"
      description="Data berhasil diambil tetapi tampilan gagal dirender. Muat ulang bagian ini."
    >
      {variant === "stakeholder" && filtered ? (
        <StakeholderScorecards summary={summary} filtered={filtered} />
      ) : variant === "branch" && filtered ? (
        <BranchScopeScorecards summary={summary} filtered={filtered} />
      ) : (
        <SummaryScorecards summary={summary} />
      )}
    </DashboardSectionBoundary>
  );
}

async function BranchChartSection({ user }: { user: SessionUser }) {
  let summary: DashboardSummary;
  try {
    summary = await summaryForRequest(user);
  } catch (error) {
    console.error("[dashboard] grafik cabang gagal dimuat", error);
    return (
      <DashboardErrorState
        title="Grafik cabang belum dapat dimuat"
        description="Ringkasan di atas tidak terpengaruh. Coba lagi tanpa mengubah filter."
      />
    );
  }

  return (
    <DashboardSectionBoundary
      title="Grafik cabang gagal ditampilkan"
      description="Data berhasil diambil tetapi tampilan gagal dirender. Muat ulang bagian ini."
    >
      <BranchChart summary={summary} />
    </DashboardSectionBoundary>
  );
}

async function InstitutionChartSection({
  user,
  params,
  variant,
}: {
  user: SessionUser;
  params: FilterParams;
  variant: DashboardVariant;
}) {
  return (
    <FilteredSection
      user={user}
      params={params}
      variant={variant}
      errorTitle="Grafik institusi belum dapat dimuat"
      errorDescription="Ringkasan di atas tidak terpengaruh. Coba lagi tanpa mengubah filter."
    >
      {(filtered) => (
        <DashboardSectionBoundary
          title="Grafik institusi gagal ditampilkan"
          description="Data berhasil diambil tetapi tampilan gagal dirender. Muat ulang bagian ini."
        >
          <InstitutionChart chart={filtered.institutionChart} />
        </DashboardSectionBoundary>
      )}
    </FilteredSection>
  );
}

async function ContentTypeSection({
  user,
  params,
  variant,
}: {
  user: SessionUser;
  params: FilterParams;
  variant: DashboardVariant;
}) {
  return (
    <FilteredSection
      user={user}
      params={params}
      variant={variant}
      errorTitle="Jenis konten belum dapat dimuat"
      errorDescription="Sebaran jenis konten tidak tersedia saat ini. Bagian lain tidak terpengaruh."
    >
      {(filtered) => (
        <DashboardSectionBoundary
          title="Jenis konten gagal ditampilkan"
          description="Data berhasil diambil tetapi tampilan gagal dirender. Muat ulang bagian ini."
        >
          <ContentTypePanel
            slices={filtered.contentTypes}
            scopeDescription={scopeDescription(variant)}
          />
        </DashboardSectionBoundary>
      )}
    </FilteredSection>
  );
}

async function TrendSection({
  user,
  params,
  variant,
}: {
  user: SessionUser;
  params: FilterParams;
  variant: DashboardVariant;
}) {
  return (
    <FilteredSection
      user={user}
      params={params}
      variant={variant}
      errorTitle="Tren bulanan belum dapat dimuat"
      errorDescription="Tren 12 bulan terakhir tidak tersedia saat ini. Bagian lain tidak terpengaruh."
    >
      {(filtered) => (
        <DashboardSectionBoundary
          title="Tren bulanan gagal ditampilkan"
          description="Data berhasil diambil tetapi tampilan gagal dirender. Muat ulang bagian ini."
        >
          <MonthlyTrendChart
            series={filtered.monthly}
            scopeDescription={scopeDescription(variant)}
          />
        </DashboardSectionBoundary>
      )}
    </FilteredSection>
  );
}

async function TypeTrendSection({
  user,
  params,
  variant,
}: {
  user: SessionUser;
  params: FilterParams;
  variant: DashboardVariant;
}) {
  return (
    <FilteredSection
      user={user}
      params={params}
      variant={variant}
      errorTitle="Tren jenis konten belum dapat dimuat"
      errorDescription="Tren per jenis konten tidak tersedia saat ini. Bagian lain tidak terpengaruh."
    >
      {(filtered) => (
        <DashboardSectionBoundary
          title="Tren jenis konten gagal ditampilkan"
          description="Data berhasil diambil tetapi tampilan gagal dirender. Muat ulang bagian ini."
        >
          <ContentTypeTrendChart
            trends={filtered.typeMonthly}
            months={filtered.monthly.points}
            scopeDescription={scopeDescription(variant)}
          />
        </DashboardSectionBoundary>
      )}
    </FilteredSection>
  );
}

async function ThemeTrendSection({
  user,
  params,
  variant,
}: {
  user: SessionUser;
  params: FilterParams;
  variant: DashboardVariant;
}) {
  return (
    <FilteredSection
      user={user}
      params={params}
      variant={variant}
      errorTitle="Tren tema belum dapat dimuat"
      errorDescription="Tren EDUFAST dan Non-EDUFAST tidak tersedia saat ini. Bagian lain tidak terpengaruh."
    >
      {(filtered) => (
        <DashboardSectionBoundary
          title="Tren tema gagal ditampilkan"
          description="Data berhasil diambil tetapi tampilan gagal dirender. Muat ulang bagian ini."
        >
          <ThemeTrendChart
            trends={filtered.themeMonthly}
            months={filtered.monthly.points}
            scopeDescription={scopeDescription(variant)}
          />
        </DashboardSectionBoundary>
      )}
    </FilteredSection>
  );
}

async function FilteredSection({
  user,
  params,
  variant,
  errorTitle,
  errorDescription,
  children,
}: {
  user: SessionUser;
  params: FilterParams;
  variant: DashboardVariant;
  errorTitle: string;
  errorDescription: string;
  children: (filtered: DashboardFiltered) => ReactNode;
}) {
  const result = await loadFiltered(user, params, variant);
  if (!result.ok) {
    return (
      <DashboardErrorState title={errorTitle} description={errorDescription} />
    );
  }
  return <>{children(result.filtered)}</>;
}

// Ten named bars stay readable inside the 380px chart budget; the remainder
// collapses into one aggregate row so totals still reconcile.
const BRANCH_CHART_ROWS = 10;

function BranchChart({ summary }: { summary: DashboardSummary }) {
  const sorted = [...summary.branches].sort(
    (left, right) =>
      right.total - left.total || left.name.localeCompare(right.name, "id"),
  );
  const rows: RankedBarRow[] = sorted
    .slice(0, BRANCH_CHART_ROWS)
    .map((branch) => ({
      id: branch.id,
      name: branch.name,
      sublabel: branch.regionName,
      total: branch.total,
      categories: branch.categories,
    }));
  const hidden = sorted.slice(BRANCH_CHART_ROWS);
  if (hidden.length > 0) {
    const categories = { FKRTL: 0, FKTP: 0, PEMDA: 0, STAKEHOLDER: 0 };
    for (const branch of hidden) {
      for (const category of DASHBOARD_CATEGORIES) {
        categories[category] += branch.categories[category];
      }
    }
    rows.push({
      id: "aggregate-cabang-lainnya",
      name: `Cabang lainnya (${formatNumberId(hidden.length)})`,
      sublabel: "Digabung pada satu bar agar tetap terbaca.",
      total: hidden.reduce((sum, branch) => sum + branch.total, 0),
      categories,
      aggregate: true,
    });
  }

  const notes = [
    hidden.length > 0
      ? `${formatNumberId(hidden.length)} cabang dengan total ${formatNumberId(rows[rows.length - 1]!.total)} konten digabung pada bar terakhir.`
      : null,
    summary.unassignedApproved > 0
      ? `${formatNumberId(summary.unassignedApproved)} konten tervalidasi belum terhubung ke cabang dan tidak tampil pada grafik ini.`
      : null,
  ].filter(Boolean);

  return (
    <RankedBarChart
      sectionId="konten-per-cabang"
      title="Konten per Cabang"
      description="Hanya konten dengan approval final, diurutkan dari total tertinggi."
      rows={rows}
      footerNote={notes.length > 0 ? notes.join(" ") : null}
      emptyMessage="Belum ada cabang dalam cakupan Anda."
    />
  );
}

function InstitutionChart({ chart }: { chart: DashboardInstitutionChart }) {
  const rows: RankedBarRow[] = chart.rows.map((row) => ({
    id: row.id,
    name: row.name,
    sublabel: row.branchName,
    total: row.total,
    categories: row.categories,
  }));
  if (chart.remaining) {
    rows.push({
      id: "aggregate-institusi-lainnya",
      name: `Institusi lainnya (${formatNumberId(chart.remaining.count)})`,
      sublabel: "Digabung pada satu bar agar tetap terbaca.",
      total: chart.remaining.total,
      categories: chart.remaining.categories,
      aggregate: true,
    });
  }

  return (
    <RankedBarChart
      sectionId="konten-per-institusi"
      title="Konten per Institusi"
      description="Institusi dengan konten terbanyak di cabang Anda, diurutkan dari total tertinggi."
      rows={rows}
      footerNote={
        chart.remaining
          ? `${formatNumberId(chart.remaining.count)} institusi dengan total ${formatNumberId(chart.remaining.total)} konten digabung pada bar terakhir.`
          : null
      }
      emptyMessage="Belum ada konten tervalidasi pada cabang Anda."
    />
  );
}

async function CollaborationSection({
  user,
  basePath,
  params,
  styleUrl,
  variant,
}: {
  user: SessionUser;
  basePath: string;
  params: FilterParams;
  styleUrl: string;
  variant: DashboardVariant;
}) {
  const result = await loadFiltered(user, params, variant);
  if (!result.ok) {
    return (
      <DashboardErrorState
        title="Data kolaborasi belum dapat dimuat"
        description="Peringkat, peta, dan checklist cabang tidak tersedia saat ini. Ringkasan di atas tidak terpengaruh."
      />
    );
  }

  return (
    <DashboardSectionBoundary
      title="Kolaborasi gagal ditampilkan"
      description="Data berhasil diambil tetapi tampilan gagal dirender. Muat ulang bagian ini."
    >
      <CollaborationView
        summary={result.summary}
        filtered={result.filtered}
        basePath={basePath}
        params={params}
        styleUrl={styleUrl}
        variant={variant}
      />
    </DashboardSectionBoundary>
  );
}

function CollaborationView({
  summary,
  filtered,
  basePath,
  params,
  styleUrl,
  variant,
}: {
  summary: DashboardSummary;
  filtered: DashboardFiltered;
  basePath: string;
  params: FilterParams;
  styleUrl: string;
  variant: DashboardVariant;
}) {
  const showFilter = variant === "national" || variant === "regional";

  return (
    <section
      id="kolaborasi"
      aria-labelledby="kolaborasi-judul"
      className="scroll-mt-20 space-y-4 sm:space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2
          id="kolaborasi-judul"
          className="text-lg font-semibold text-foreground"
        >
          Kolaborasi
        </h2>
        {variant === "branch" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-xs text-ink-muted">
            <Building2 className="size-3.5" aria-hidden />
            {summary.branches[0]?.name ?? "Cabang Anda"}
          </span>
        ) : null}
      </div>
      {showFilter ? (
        <BranchChecklist
          basePath={basePath}
          params={params}
          branches={summary.branches}
          selection={filtered.selection}
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {DASHBOARD_CATEGORIES.map((category) => (
          <CategoryRankingPanel
            key={category}
            category={category}
            anchor={CATEGORY_ANCHORS[category]}
            score={filtered.categoryTotals[category]}
            rows={filtered.rankings[category]}
            scopeDescription={scopeDescription(variant)}
          />
        ))}
      </div>
      <DashboardMapSection
        map={filtered.map}
        styleUrl={styleUrl}
        variant={variant}
      />
    </section>
  );
}

async function ThemeSection({
  user,
  params,
  variant,
}: {
  user: SessionUser;
  params: FilterParams;
  variant: DashboardVariant;
}) {
  const result = await loadFiltered(user, params, variant);
  if (!result.ok) {
    return (
      <DashboardErrorState
        title="Tema konten belum dapat dimuat"
        description="Ringkasan EDUFAST dan Non-EDUFAST tidak tersedia saat ini. Bagian lain tidak terpengaruh."
      />
    );
  }

  return (
    <DashboardSectionBoundary
      title="Tema konten gagal ditampilkan"
      description="Data berhasil diambil tetapi tampilan gagal dirender. Muat ulang bagian ini."
    >
      <ThemePanel
        edufast={result.filtered.edufast}
        nonEdufast={result.filtered.nonEdufast}
        unclassifiedTheme={result.filtered.unclassifiedTheme}
        themes={result.filtered.nonEdufastThemes}
        scopeDescription={scopeDescription(variant)}
        showScorecards={variant !== "stakeholder"}
      />
    </DashboardSectionBoundary>
  );
}
