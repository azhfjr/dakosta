import { Trophy } from "lucide-react";

import { CATEGORY_CHART_COLORS } from "@/lib/chart-theme";
import {
  DASHBOARD_CATEGORY_LABELS,
  type DashboardCategory,
  type DashboardRankingRow,
} from "@/lib/dashboard/types";
import { formatShareId, rankingShare } from "@/lib/dashboard/ranking";
import { formatNumberId } from "@/lib/dates";

function rowTitle(row: DashboardRankingRow): string {
  return row.branchName ? `${row.name} · ${row.branchName}` : row.name;
}

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
  const color = CATEGORY_CHART_COLORS[category];
  const headingId = `${anchor}-judul`;

  return (
    <section
      id={anchor}
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col rounded-xl border border-border bg-surface p-4 shadow-sm xl:p-2"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3
          id={headingId}
          className="text-base font-semibold text-foreground xl:text-sm"
        >
          Konten {label}
        </h3>
        <h4 className="flex items-center gap-1 text-xs font-semibold text-ink-muted xl:text-[10px] xl:tracking-wide xl:uppercase">
          <Trophy className="size-3.5 xl:hidden" aria-hidden />
          10 {label} Teratas
        </h4>
      </div>

      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular xl:mt-0 xl:text-lg xl:leading-6">
        {formatNumberId(score)}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted xl:sr-only">
        Total seluruh konten tervalidasi pada cabang terpilih.
      </p>

      <div className="mt-3 border-t border-border pt-2 xl:mt-1 xl:pt-0.5">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-3 py-4 text-center text-sm text-ink-muted">
            Belum ada konten tervalidasi pada kategori ini.
          </p>
        ) : (
          <ol className="space-y-2.5 xl:space-y-0">
            {rows.map((row, index) => {
              const share = rankingShare(row.total, score);
              const percent = formatShareId(share);
              return (
                <li
                  key={`${row.stakeholderId}-${row.branchId ?? "tanpa-cabang"}`}
                  className="relative min-w-0 pb-1 xl:pb-px"
                >
                  <div className="flex items-center gap-2 xl:h-4">
                    <span className="w-4 shrink-0 text-right text-[10px] font-semibold text-ink-muted tabular">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium text-foreground xl:text-xs"
                        title={rowTitle(row)}
                      >
                        {row.name}
                      </p>
                      <p className="truncate text-xs text-ink-muted xl:sr-only">
                        {row.branchName ?? "Belum terhubung ke cabang"}
                      </p>
                    </div>
                    <span
                      data-ranking-share
                      className="w-9 text-right text-[10px] text-ink-muted tabular"
                    >
                      {percent}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-foreground tabular xl:text-xs">
                      {formatNumberId(row.total)}
                    </span>
                  </div>
                  <div
                    data-ranking-track
                    role="progressbar"
                    aria-label={`${row.name}: ${percent} dari total ${label}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(share)}
                    className="ml-6 mt-1 h-1 overflow-hidden rounded-full bg-surface-muted xl:absolute xl:inset-x-0 xl:bottom-0 xl:mt-0 xl:h-0.5 xl:ml-0"
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
