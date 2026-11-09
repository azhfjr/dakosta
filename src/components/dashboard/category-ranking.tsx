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
import { rankingShare } from "@/lib/dashboard/ranking";
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
  scopeDescription,
}: {
  category: DashboardCategory;
  anchor: string;
  score: number;
  rows: DashboardRankingRow[];
  scopeDescription: string;
}) {
  const label = DASHBOARD_CATEGORY_LABELS[category];
  const Icon = CATEGORY_ICONS[category];
  const color = CATEGORY_CHART_COLORS[category];
  const headingId = `${anchor}-judul`;

  return (
    <section
      id={anchor}
      aria-labelledby={headingId}
      data-ranking-panel
      data-dashboard-panel
      className="h-full scroll-mt-20 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            id={headingId}
            className="text-base font-semibold text-foreground"
          >
            Konten {label}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Total seluruh konten tervalidasi pada {scopeDescription}.
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

      <div className="mt-4 border-t border-border pt-4">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Trophy className="size-4 text-ink-muted" aria-hidden />
          10 {label} Teratas
        </h4>

        {rows.length === 0 ? (
          <p className="mt-3 flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/40 px-3 text-center text-sm text-ink-muted">
            Belum ada konten tervalidasi pada kategori ini.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {rows.map((row, index) => {
              const share = rankingShare(row.total, score);
              return (
                <li
                  key={`${row.stakeholderId}-${row.branchId ?? "tanpa-cabang"}`}
                  className="min-w-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 w-5 shrink-0 text-right text-xs font-semibold text-ink-muted tabular">
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
                    <span className="shrink-0 text-sm font-semibold text-foreground tabular">
                      {formatNumberId(row.total)}
                    </span>
                  </div>
                  <div
                    data-ranking-track
                    role="progressbar"
                    aria-label={`${row.name}: ${formatNumberId(row.total)} konten ${label}`}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(score, 1)}
                    aria-valuenow={row.total}
                    aria-valuetext={`${formatNumberId(row.total)} konten`}
                    className="mt-1.5 ml-7 h-1.5 overflow-hidden rounded-full bg-surface-muted"
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
