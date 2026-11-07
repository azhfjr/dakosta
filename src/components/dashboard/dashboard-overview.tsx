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
    <div className="space-y-8">
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
        <CollaborationSection
          user={user}
          basePath={basePath}
          params={params}
          styleUrl={styleUrl}
        />
      </Suspense>
      <Suspense
        fallback={
          <DashboardSectionSkeleton label="Memuat tema konten…" rows={2} />
        }
      >
        <ThemeSection user={user} params={params} />
      </Suspense>
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
      <div className="space-y-4">
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
  styleUrl,
}: {
  user: SessionUser;
  basePath: string;
  params: FilterParams;
  styleUrl: string;
}) {
  const result = await loadFiltered(user, params);
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
}: {
  summary: DashboardSummary;
  filtered: DashboardFiltered;
  basePath: string;
  params: FilterParams;
  styleUrl: string;
}) {
  const branches: DashboardBranchRow[] = summary.branches;
  return (
    <section
      id="kolaborasi"
      aria-labelledby="kolaborasi-judul"
      className="space-y-4"
    >
      <h2
        id="kolaborasi-judul"
        className="text-lg font-semibold text-foreground"
      >
        Kolaborasi
      </h2>
      <BranchChecklist
        basePath={basePath}
        params={params}
        branches={branches}
        selection={filtered.selection}
      />
      <div className="grid gap-4 sm:grid-cols-2">
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
      <DashboardMapSection map={filtered.map} styleUrl={styleUrl} />
    </section>
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
