import {
  Building2,
  FileCheck2,
  GraduationCap,
  Hospital,
  Landmark,
  Layers,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { formatShareId } from "@/lib/dashboard/series";
import {
  DASHBOARD_CATEGORIES,
  DASHBOARD_CATEGORY_LABELS,
  type DashboardCategory,
  type DashboardFiltered,
  type DashboardSummary,
} from "@/lib/dashboard/types";
import { formatNumberId } from "@/lib/dates";

const SCOPE_GRID =
  "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6";

const CATEGORY_CARDS: Record<
  DashboardCategory,
  { icon: LucideIcon; tone: "green" | "teal" | "blue" | "amber"; hint: string }
> = {
  FKRTL: {
    icon: Hospital,
    tone: "green",
    hint: "Fasilitas kesehatan rujukan tingkat lanjut.",
  },
  FKTP: {
    icon: Stethoscope,
    tone: "teal",
    hint: "Fasilitas kesehatan tingkat pertama.",
  },
  PEMDA: {
    icon: Landmark,
    tone: "blue",
    hint: "Pemerintah daerah.",
  },
  STAKEHOLDER: {
    icon: Building2,
    tone: "amber",
    hint: "Stakeholder mitra di luar faskes dan pemda.",
  },
};

function CategoryScorecards({ summary }: { summary: DashboardSummary }) {
  return (
    <>
      {DASHBOARD_CATEGORIES.map((category) => {
        const card = CATEGORY_CARDS[category];
        const share = formatShareId(summary.categoryShares[category]);
        return (
          <StatCard
            key={category}
            label={DASHBOARD_CATEGORY_LABELS[category]}
            value={formatNumberId(summary.categoryTotals[category])}
            share={{
              value: share,
              srLabel: `${share} dari konten tervalidasi terkategori`,
            }}
            hint={card.hint}
            icon={card.icon}
            tone={card.tone}
            size="compact"
          />
        );
      })}
    </>
  );
}

export function SummaryScorecards({ summary }: { summary: DashboardSummary }) {
  const zeroBranches = summary.branchCount === 0;
  return (
    <section
      id="ringkasan"
      aria-label="Ringkasan konten tervalidasi"
      className="scroll-mt-20"
    >
      <div className={SCOPE_GRID}>
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
        <CategoryScorecards summary={summary} />
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
      <div className={SCOPE_GRID}>
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
        <CategoryScorecards summary={summary} />
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
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="Total Konten Tervalidasi"
          value={formatNumberId(summary.totalApproved)}
          hint="Seluruh riwayat, hanya konten dengan approval final."
          icon={FileCheck2}
          tone="green"
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
