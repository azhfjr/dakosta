"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts";

import {
  MonthlyColumnsCard,
  type MonthlyColumnsSeries,
} from "@/components/dashboard/monthly-trend-chart";
import {
  CONTENT_TYPE_CHART_COLORS,
  DASHBOARD_THEME_CHART_COLORS,
  tooltipStyle,
} from "@/lib/chart-theme";
import { formatShareId } from "@/lib/dashboard/series";
import type {
  DashboardContentTypeSlice,
  DashboardMonthlyPoint,
  DashboardThemeTrend,
  DashboardTypeTrend,
} from "@/lib/dashboard/types";
import { formatNumberId } from "@/lib/dates";

function SliceTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as DashboardContentTypeSlice | undefined;
  if (!row) return null;
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <p className="text-xs font-semibold text-foreground">{row.label}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {formatNumberId(row.total)} konten · {formatShareId(row.share)}
      </p>
    </div>
  );
}

export function ContentTypePanel({
  slices,
  scopeDescription,
}: {
  slices: DashboardContentTypeSlice[];
  scopeDescription: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.total, 0);
  const hasData = total > 0 && slices.length > 0;

  return (
    <section
      id="jenis-konten"
      aria-labelledby="jenis-konten-judul"
      data-dashboard-panel
      data-content-type-panel
      className="scroll-mt-20 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="jenis-konten-judul"
            className="text-base font-semibold text-foreground"
          >
            Jenis Konten
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Sebaran konten tervalidasi berdasarkan jenis konten pada{" "}
            {scopeDescription}.
          </p>
        </div>
        <p className="shrink-0 text-xs text-ink-muted">
          <span className="font-semibold text-foreground tabular">
            {formatNumberId(total)}
          </span>{" "}
          konten
        </p>
      </div>

      {!hasData ? (
        <div className="mt-3 flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 text-center text-sm text-ink-muted">
          Belum ada konten tervalidasi pada {scopeDescription}.
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:gap-4 md:grid-cols-[260px_minmax(0,1fr)] md:items-center">
            <div
              data-content-type-donut
              className="relative h-[220px] w-full md:w-[260px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer>
                  <Pie
                    data={slices}
                    dataKey="total"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="82%"
                    paddingAngle={1}
                    stroke="var(--surface)"
                    strokeWidth={1}
                    isAnimationActive={false}
                  >
                    {slices.map((entry) => (
                      <Cell
                        key={entry.type}
                        fill={CONTENT_TYPE_CHART_COLORS[entry.type]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={SliceTooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-semibold text-foreground tabular">
                  {formatNumberId(total)}
                </p>
                <p className="text-xs text-ink-muted">konten</p>
              </div>
            </div>

            <ul className="space-y-1.5">
              {slices.map((entry) => (
                <li
                  key={entry.type}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm odd:bg-surface-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: CONTENT_TYPE_CHART_COLORS[entry.type],
                      }}
                      aria-hidden
                    />
                    <span className="min-w-0 break-words text-foreground">
                      {entry.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted tabular">
                    <span className="font-semibold text-foreground">
                      {formatNumberId(entry.total)}
                    </span>{" "}
                    · {formatShareId(entry.share)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="sr-only">
            <table>
              <caption>
                Jenis konten, jumlah konten tervalidasi, dan persentase
              </caption>
              <thead>
                <tr>
                  <th scope="col">Jenis konten</th>
                  <th scope="col">Jumlah konten</th>
                  <th scope="col">Persentase</th>
                </tr>
              </thead>
              <tbody>
                {slices.map((entry) => (
                  <tr key={entry.type}>
                    <th scope="row">{entry.label}</th>
                    <td>{formatNumberId(entry.total)}</td>
                    <td>{formatShareId(entry.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export function ContentTypeTrendChart({
  trends,
  months,
  scopeDescription,
}: {
  trends: DashboardTypeTrend[];
  months: DashboardMonthlyPoint[];
  scopeDescription: string;
}) {
  const series: MonthlyColumnsSeries[] = trends.map((trend) => ({
    key: trend.type,
    label: trend.label,
    color: CONTENT_TYPE_CHART_COLORS[trend.type],
    points: trend.points,
    total: trend.total,
  }));

  return (
    <MonthlyColumnsCard
      sectionId="tren-jenis-konten"
      title="Tren Bulanan per Jenis Konten"
      description={`Konten tervalidasi per bulan untuk setiap jenis konten pada ${scopeDescription}.`}
      months={months}
      series={series}
      emptyMessage={`Belum ada konten tervalidasi per jenis konten pada ${scopeDescription} dalam 12 bulan terakhir.`}
    />
  );
}

export function ThemeTrendChart({
  trends,
  months,
  scopeDescription,
}: {
  trends: DashboardThemeTrend[];
  months: DashboardMonthlyPoint[];
  scopeDescription: string;
}) {
  const series: MonthlyColumnsSeries[] = trends.map((trend) => ({
    key: trend.key,
    label: trend.label,
    color: DASHBOARD_THEME_CHART_COLORS[trend.key],
    points: trend.points,
    total: trend.total,
  }));

  return (
    <MonthlyColumnsCard
      sectionId="tren-tema"
      title="Tren Bulanan per Tema"
      description={`Konten tervalidasi per bulan untuk tema EDUFAST dan Non-EDUFAST pada ${scopeDescription}.`}
      months={months}
      series={series}
      emptyMessage={`Belum ada konten tervalidasi per tema pada ${scopeDescription} dalam 12 bulan terakhir.`}
    />
  );
}
