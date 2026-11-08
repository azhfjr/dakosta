import { Building2, FileCheck2 } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import type { DashboardSummary } from "@/lib/dashboard/types";
import { formatNumberId } from "@/lib/dates";

export function SummaryScorecards({ summary }: { summary: DashboardSummary }) {
  const zeroBranches = summary.branchCount === 0;
  return (
    <section
      id="ringkasan"
      aria-label="Ringkasan konten tervalidasi"
      className="min-w-0"
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <StatCard
          label="Total Konten Tervalidasi"
          value={formatNumberId(summary.totalApproved)}
          hint="Seluruh riwayat, hanya konten dengan approval final."
          icon={FileCheck2}
          tone="green"
          size="dense"
        />
        <StatCard
          label="Cabang dengan Konten"
          value={`${formatNumberId(summary.branchesWithContent)} dari ${formatNumberId(summary.branchCount)} cabang`}
          hint={
            zeroBranches
              ? "Belum terhubung ke cabang."
              : summary.branchCount > summary.branchesWithContent
                ? `${formatNumberId(summary.branchCount - summary.branchesWithContent)} cabang belum memiliki konten tervalidasi.`
                : "Seluruh cabang dalam cakupan sudah memiliki konten tervalidasi."
          }
          icon={Building2}
          tone="blue"
          size="dense"
        />
      </div>
    </section>
  );
}

export function ThemeScorecards({
  edufast,
  nonEdufast,
}: {
  edufast: number;
  nonEdufast: number;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
      <div
        id="edufast"
        className="rounded-lg border border-border bg-surface-muted/40 px-2.5 py-2"
      >
        <p className="text-[10px] font-semibold tracking-wide text-ink-muted uppercase">
          Konten EDUFAST
        </p>
        <p className="mt-0.5 text-lg font-semibold tracking-tight text-foreground tabular">
          {formatNumberId(edufast)}
        </p>
      </div>
      <div
        id="non-edufast"
        className="rounded-lg border border-border bg-surface-muted/40 px-2.5 py-2"
      >
        <p className="text-[10px] font-semibold tracking-wide text-ink-muted uppercase">
          Konten Non-EDUFAST
        </p>
        <p className="mt-0.5 text-lg font-semibold tracking-tight text-foreground tabular">
          {formatNumberId(nonEdufast)}
        </p>
      </div>
    </div>
  );
}
