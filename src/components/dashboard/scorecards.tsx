import { Building2, FileCheck2, GraduationCap, Layers } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import type { DashboardSummary } from "@/lib/dashboard/types";
import { formatNumberId } from "@/lib/dates";

export function SummaryScorecards({ summary }: { summary: DashboardSummary }) {
  const zeroBranches = summary.branchCount === 0;
  return (
    <section id="ringkasan" aria-label="Ringkasan konten tervalidasi">
      <div className="grid gap-4 sm:grid-cols-2">
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

export function ThemeScorecards({
  edufast,
  nonEdufast,
}: {
  edufast: number;
  nonEdufast: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      <div id="edufast">
        <StatCard
          label="Konten EDUFAST"
          value={formatNumberId(edufast)}
          hint="Tema utama EDUFAST pada cabang terpilih."
          icon={GraduationCap}
          tone="teal"
          size="compact"
        />
      </div>
      <div id="non-edufast">
        <StatCard
          label="Konten Non-EDUFAST"
          value={formatNumberId(nonEdufast)}
          hint="Seluruh tema utama selain EDUFAST pada cabang terpilih."
          icon={Layers}
          tone="amber"
          size="compact"
        />
      </div>
    </div>
  );
}
