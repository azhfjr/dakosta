import { cache, Suspense } from "react";

import { BranchChecklist } from "@/components/dashboard/branch-checklist";
import { BranchStackChart } from "@/components/dashboard/branch-stack-chart";
import { CategoryRankingPanel } from "@/components/dashboard/category-ranking";
import { DashboardMapSection } from "@/components/dashboard/dashboard-map";
import {
  DashboardErrorState,
  DashboardSectionBoundary,
  DashboardSectionSkeleton,
} from "@/components/dashboard/dashboard-states";
import { SummaryScorecards } from "@/components/dashboard/scorecards";
import { ThemePanel } from "@/components/dashboard/theme-panel";
import {
  getDashboardFiltered,
  getDashboardSummary,
} from "@/lib/analytics/dashboard-overview";
import {
  DASHBOARD_CATEGORIES,
  type DashboardBranchRow,
  type DashboardCategory,
  type DashboardFiltered,
  type DashboardSummary,
} from "@/lib/dashboard/types";
import {
  parseBranchSelection,
  type BranchSelection,
} from "@/lib/filters/branch-selection";
import type { FilterParams } from "@/lib/filters/query";
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
  return (
    <div className="space-y-4 xl:space-y-3">
      <Suspense
        fallback={
          <DashboardSectionSkeleton label="Memuat ringkasan…" rows={2} />
        }
      >
        <SummarySection user={user} />
      </Suspense>
      <Suspense
        fallback={
          <DashboardSectionSkeleton label="Memuat kolaborasi…" rows={4} />
        }
      >
        <CollaborationSection user={user} basePath={basePath} params={params} />
      </Suspense>
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <Suspense
          fallback={<DashboardSectionSkeleton label="Memuat peta…" rows={1} />}
        >
          <MapSection user={user} params={params} styleUrl={styleUrl} />
        </Suspense>
        <Suspense
          fallback={
            <DashboardSectionSkeleton label="Memuat tema konten…" rows={2} />
          }
        >
          <ThemeSection user={user} params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function SummarySection({ user }: { user: SessionUser }) {
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

  return (
    <DashboardSectionBoundary
      title="Ringkasan gagal ditampilkan"
      description="Data berhasil diambil tetapi tampilan gagal dirender. Muat ulang bagian ini."
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:items-stretch">
        <SummaryScorecards summary={summary} />
        <BranchStackChart
          branches={summary.branches}
          unassignedApproved={summary.unassignedApproved}
        />
      </div>
    </DashboardSectionBoundary>
  );
}

async function loadFiltered(
  user: SessionUser,
  params: FilterParams,
): Promise<
  | { ok: true; summary: DashboardSummary; filtered: DashboardFiltered }
  | { ok: false }
> {
  try {
    const summary = await summaryForRequest(user);
    const selection = parseBranchSelection(
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

async function CollaborationSection({
  user,
  basePath,
  params,
}: {
  user: SessionUser;
  basePath: string;
  params: FilterParams;
}) {
  const result = await loadFiltered(user, params);
  if (!result.ok) {
    return (
      <DashboardErrorState
        title="Data kolaborasi belum dapat dimuat"
        description="Peringkat dan checklist cabang tidak tersedia saat ini. Ringkasan di atas tidak terpengaruh."
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
      />
    </DashboardSectionBoundary>
  );
}

function CollaborationView({
  summary,
  filtered,
  basePath,
  params,
}: {
  summary: DashboardSummary;
  filtered: DashboardFiltered;
  basePath: string;
  params: FilterParams;
}) {
  const branches: DashboardBranchRow[] = summary.branches;
  return (
    <section
      id="kolaborasi"
      aria-labelledby="kolaborasi-judul"
      className="min-w-0"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="kolaborasi-judul"
          className="text-base font-semibold text-foreground xl:text-sm"
        >
          Kolaborasi
        </h2>
        <div className="min-w-0 flex-1">
          <BranchChecklist
            basePath={basePath}
            params={params}
            branches={branches}
            selection={filtered.selection}
          />
        </div>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {DASHBOARD_CATEGORIES.map((category) => (
          <CategoryRankingPanel
            key={category}
            category={category}
            anchor={CATEGORY_ANCHORS[category]}
            score={filtered.categoryTotals[category]}
            rows={filtered.rankings[category]}
          />
        ))}
      </div>
    </section>
  );
}

async function MapSection({
  user,
  params,
  styleUrl,
}: {
  user: SessionUser;
  params: FilterParams;
  styleUrl: string;
}) {
  const result = await loadFiltered(user, params);
  if (!result.ok) {
    return (
      <DashboardErrorState
        title="Peta belum dapat dimuat"
        description="Sebaran konten tidak tersedia saat ini. Bagian lain tidak terpengaruh."
      />
    );
  }

  return (
    <DashboardSectionBoundary
      title="Peta gagal ditampilkan"
      description="Data berhasil diambil tetapi tampilan gagal dirender. Muat ulang bagian ini."
    >
      <DashboardMapSection map={result.filtered.map} styleUrl={styleUrl} />
    </DashboardSectionBoundary>
  );
}

async function ThemeSection({
  user,
  params,
}: {
  user: SessionUser;
  params: FilterParams;
}) {
  const result = await loadFiltered(user, params);
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
      />
    </DashboardSectionBoundary>
  );
}
