import { Building2, FileCheck2, GraduationCap, Layers } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import type {
  DashboardFiltered,
  DashboardSummary,
} from "@/lib/dashboard/types";
import { formatNumberId } from "@/lib/dates";

const CARD_GRID = "grid gap-3 sm:grid-cols-2 sm:gap-4";

export function SummaryScorecards({ summary }: { summary: DashboardSummary }) {
  const zeroBranches = summary.branchCount === 0;
  return (
    <section
      id="ringkasan"
      aria-label="Ringkasan konten tervalidasi"
      className="scroll-mt-20"
    >
      <div className={CARD_GRID}>
        <StatCard
          label="Total Konten Tervalidasi"
          value={formatNumberId(summary.totalApproved)}
          hint="Seluruh riwayat, hanya konten dengan approval final."
          icon={FileCheck2}
          tone="green"
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
        />
      </div>
    </section>
  );
}

export function BranchScopeScorecards({
  summary,
  filtered,
}: {
  summary: DashboardSummary;
  filtered: DashboardFiltered;
}) {
  return (
    <section
      id="ringkasan"
      aria-label="Ringkasan konten cabang"
      className="scroll-mt-20"
    >
      <div className={CARD_GRID}>
        <StatCard
          label="Total Konten Tervalidasi"
          value={formatNumberId(summary.totalApproved)}
          hint="Seluruh riwayat, hanya konten dengan approval final."
          icon={FileCheck2}
          tone="green"
        />
        <StatCard
          label="Institusi dengan Konten"
          value={`${formatNumberId(filtered.map.totals.institutions)} institusi`}
          hint="Institusi pada cabang Anda yang memiliki konten tervalidasi."
          icon={Building2}
          tone="blue"
        />
      </div>
    </section>
  );
}

export function StakeholderScorecards({
  summary,
  filtered,
}: {
  summary: DashboardSummary;
  filtered: DashboardFiltered;
}) {
  return (
    <section
      id="ringkasan"
      aria-label="Ringkasan konten organisasi"
      className="scroll-mt-20"
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Konten Tervalidasi"
          value={formatNumberId(summary.totalApproved)}
          hint="Seluruh riwayat, hanya konten dengan approval final."
          icon={FileCheck2}
          tone="green"
        />
        <StatCard
          label="Institusi dengan Konten"
          value={`${formatNumberId(filtered.map.totals.institutions)} institusi`}
          hint="Institusi organisasi Anda yang memiliki konten tervalidasi."
          icon={Building2}
          tone="blue"
        />
        <StatCard
          id="edufast"
          label="Konten EDUFAST"
          value={formatNumberId(filtered.edufast)}
          hint="Tema utama EDUFAST pada organisasi Anda."
          icon={GraduationCap}
          tone="teal"
        />
        <StatCard
          id="non-edufast"
          label="Konten Non-EDUFAST"
          value={formatNumberId(filtered.nonEdufast)}
          hint="Seluruh tema utama selain EDUFAST pada organisasi Anda."
          icon={Layers}
          tone="amber"
        />
      </div>
    </section>
  );
}

export function ThemeScorecards({
  edufast,
  nonEdufast,
  scopeDescription,
}: {
  edufast: number;
  nonEdufast: number;
  scopeDescription: string;
}) {
  return (
    <div className="grid h-full gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-1 lg:grid-rows-2">
      <div id="edufast" className="scroll-mt-20">
        <StatCard
          label="Konten EDUFAST"
          value={formatNumberId(edufast)}
          hint={`Tema utama EDUFAST pada ${scopeDescription}.`}
          icon={GraduationCap}
          tone="teal"
          size="compact"
        />
      </div>
      <div id="non-edufast" className="scroll-mt-20">
        <StatCard
          label="Konten Non-EDUFAST"
          value={formatNumberId(nonEdufast)}
          hint={`Seluruh tema utama selain EDUFAST pada ${scopeDescription}.`}
          icon={Layers}
          tone="amber"
          size="compact"
        />
      </div>
    </div>
  );
}
