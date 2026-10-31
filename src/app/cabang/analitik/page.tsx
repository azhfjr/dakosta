import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  ClipboardCheck,
  Clock3,
  Percent,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { DistributionCard } from "@/components/analytics/distribution-card";
import { RankingsTable } from "@/components/analytics/rankings-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  getContentTypeDistribution,
  getEdufastCompliance,
  getMainThemeDistribution,
  getSubThemeDistribution,
} from "@/lib/analytics/distribution";
import { getScopedMetrics } from "@/lib/analytics/metrics";
import { formatNumberId } from "@/lib/dates";
import { periodLabel } from "@/lib/edufast/policy";
import { listFaskesRankings } from "@/lib/hierarchy";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Analitik cabang",
};

export const dynamic = "force-dynamic";

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${formatNumberId(value)}%`;
}

export default async function BranchAnalyticsPage() {
  const user = await requireRole("BRANCH_ADMIN");

  const [metrics, contentType, mainTheme, subTheme, compliance, rankings] =
    await Promise.all([
      getScopedMetrics(user),
      getContentTypeDistribution(user),
      getMainThemeDistribution(user),
      getSubThemeDistribution(user),
      getEdufastCompliance(user),
      listFaskesRankings(user.scope, 10),
    ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Analitik cabang
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Kinerja {user.scopeLabel} pada periode {periodLabel(metrics.month)}.
            Dasar perhitungan: tanggal konten.
          </p>
        </div>
        <Button asChild variant="outline" className="h-10">
          <Link href="/cabang/red-notice">Lihat Red Notice</Link>
        </Button>
      </header>

      <section
        aria-label="Metrik kunci cabang"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"
      >
        <StatCard
          label="Disetujui"
          value={formatNumberId(metrics.approved)}
          hint="Hanya konten berstatus disetujui"
          icon={BadgeCheck}
          tone="teal"
        />
        <StatCard
          label="Terkirim"
          value={formatNumberId(metrics.submitted)}
          hint="Termasuk yang sedang ditinjau"
          icon={ClipboardCheck}
          tone="blue"
        />
        <StatCard
          label="Menunggu validasi"
          value={formatNumberId(metrics.pending)}
          hint="Perlu keputusan cabang"
          icon={Clock3}
          tone="amber"
        />
        <StatCard
          label="Perlu revisi"
          value={formatNumberId(metrics.revisionRequested)}
          hint="Menunggu perbaikan organisasi"
          icon={RotateCcw}
          tone="amber"
        />
        <StatCard
          label="Ditolak"
          value={formatNumberId(metrics.rejected)}
          hint="Tidak dihitung dalam capaian"
          icon={XCircle}
          tone="neutral"
        />
        <StatCard
          label="Rasio persetujuan"
          value={formatPercent(metrics.approvalRate)}
          hint="Disetujui dibagi keputusan"
          icon={Percent}
          tone="neutral"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DistributionCard
          title="Jenis konten"
          description="Video dan infografis disetujui."
          rows={contentType}
        />
        <DistributionCard
          title="Tema utama"
          description="EDUFAST dibanding Non-EDUFAST."
          rows={mainTheme}
        />
        <DistributionCard
          title="Sub-tema"
          description="Sebaran enam sub-tema."
          rows={subTheme}
        />
      </section>

      <section
        aria-label="Kepatuhan EDUFAST"
        className="grid gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm sm:grid-cols-2"
      >
        <div>
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
            Disetujui EDUFAST
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {formatNumberId(compliance.edufastApproved)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
            Disetujui Non-EDUFAST
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {formatNumberId(compliance.nonEdufastApproved)}
          </p>
        </div>
      </section>

      <RankingsTable rows={rankings} title="Peringkat Faskes cabang" />
    </div>
  );
}
