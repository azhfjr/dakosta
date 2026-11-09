import {
  Building2,
  Hospital,
  Landmark,
  Stethoscope,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { CATEGORY_CHART_COLORS } from "@/lib/chart-theme";
import {
  DASHBOARD_CATEGORY_LABELS,
  type DashboardCategory,
  type DashboardRankingRow,
} from "@/lib/dashboard/types";
import { formatShareId, rankingShare } from "@/lib/dashboard/ranking";
import { formatNumberId } from "@/lib/dates";

const CATEGORY_ICONS: Record<DashboardCategory, LucideIcon> = {
  FKRTL: Hospital,
  FKTP: Stethoscope,
  PEMDA: Landmark,
  STAKEHOLDER: Building2,
};

export function CategoryRankingPanel({
  category,
  anchor,
  score,
  rows,
}: {
  category: DashboardCategory;
  anchor: string;
  score: number;
  rows: DashboardRankingRow[];
}) {
  const label = DASHBOARD_CATEGORY_LABELS[category];
  const Icon = CATEGORY_ICONS[category];
  const color = CATEGORY_CHART_COLORS[category];
  const headingId = `${anchor}-judul`;

  return (
    <section
      id={anchor}
      aria-labelledby={headingId}
      className="scroll-mt-20 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            id={headingId}
            className="text-base font-semibold text-foreground"
          >
            Konten {label}
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Total seluruh konten tervalidasi pada cabang terpilih.
          </p>
        </div>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted"
          aria-hidden
        >
          <Icon className="size-[18px]" />
        </span>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular">
        {formatNumberId(score)}
      </p>

      <div className="mt-4 border-t border-border pt-3">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Trophy className="size-4 text-ink-muted" aria-hidden />
          10 {label} Teratas
        </h4>

        {rows.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border bg-surface-muted/40 px-3 py-6 text-center text-sm text-ink-muted">
            Belum ada konten tervalidasi pada kategori ini.
          </p>
        ) : (
          <ol className="mt-3 space-y-2.5">
            {rows.map((row, index) => {
              const share = rankingShare(row.total, score);
              const percent = formatShareId(share);
              return (
                <li
                  key={`${row.stakeholderId}-${row.branchId ?? "tanpa-cabang"}`}
                  className="min-w-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 w-4 shrink-0 text-right text-xs font-semibold text-ink-muted tabular">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-foreground">
                          {row.name}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {row.branchName ?? "Belum terhubung ke cabang"}
                        </p>
                      </div>
                    </div>
                    <span className="flex shrink-0 items-baseline gap-2">
                      <span
                        data-ranking-share
                        className="w-11 text-right text-xs text-ink-muted tabular"
                      >
                        {percent}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-foreground tabular">
                        {formatNumberId(row.total)}
                      </span>
                    </span>
                  </div>
                  <div
                    data-ranking-track
                    role="progressbar"
                    aria-label={`${row.name}: ${percent} dari total ${label}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(share)}
                    className="ml-6 mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                  >
                    <div
                      data-ranking-fill
                      className="h-full rounded-full"
                      style={{
                        width: `${share}%`,
                        minWidth: row.total > 0 ? 2 : undefined,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
