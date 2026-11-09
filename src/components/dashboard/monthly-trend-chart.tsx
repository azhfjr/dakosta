"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import { ChartLegendChip } from "@/components/charts/chart-frame";
import {
  CHART_AXIS,
  CHART_GRID,
  MONTHLY_TREND_COLOR,
  tooltipStyle,
} from "@/lib/chart-theme";
import { monthLongLabel, monthAxisLabel } from "@/lib/dashboard/series";
import type {
  DashboardMonthlyPoint,
  DashboardMonthlySeries,
} from "@/lib/dashboard/types";
import { formatNumberId } from "@/lib/dates";

export type MonthlyColumnsSeries = {
  key: string;
  label: string;
  color: string;
  points: readonly DashboardMonthlyPoint[];
  total: number;
};

type ChartDatum = Record<string, string | number> & {
  key: string;
  label: string;
  monthLabel: string;
  monthTotal: number;
};

function MonthlyTooltip({
  active,
  payload,
  series,
}: TooltipContentProps & { series: readonly MonthlyColumnsSeries[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as ChartDatum | undefined;
  if (!row) return null;
  return (
    <div style={tooltipStyle} className="min-w-[180px] px-3 py-2.5">
      <p className="text-xs font-semibold text-foreground">{row.monthLabel}</p>
      <ul className="mt-1.5 space-y-1">
        {series.map((entry) => (
          <li
            key={entry.key}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              {entry.label}
            </span>
            <span className="font-semibold text-foreground tabular">
              {formatNumberId(Number(row[entry.key] ?? 0))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 border-t border-border pt-1.5 text-xs text-ink-muted">
        Total bulan ini{" "}
        <span className="font-semibold text-foreground tabular">
          {formatNumberId(row.monthTotal)}
        </span>
      </p>
    </div>
  );
}

/**
 * Shared 12-column monthly chart used by the overall trend, the per content
 * type trend, and the EDUFAST split so all three stay visually identical.
 */
export function MonthlyColumnsCard({
  sectionId,
  title,
  description,
  months,
  series,
  footerNote = "12 bulan terakhir · dihitung dari tanggal disetujui (WIB).",
  emptyMessage,
}: {
  sectionId: string;
  title: string;
  description: string;
  months: readonly DashboardMonthlyPoint[];
  series: readonly MonthlyColumnsSeries[];
  footerNote?: string;
  emptyMessage: string;
}) {
  const rows: ChartDatum[] = months.map((month) => {
    const row: ChartDatum = {
      key: month.key,
      label: month.label,
      monthLabel: monthLongLabel(month.key),
      monthTotal: 0,
    };
    let monthTotal = 0;
    for (const entry of series) {
      const value =
        entry.points.find((item) => item.key === month.key)?.total ?? 0;
      row[entry.key] = value;
      monthTotal += value;
    }
    row.monthTotal = monthTotal;
    return row;
  });
  const windowTotal = rows.reduce((sum, row) => sum + row.monthTotal, 0);
  const hasData = windowTotal > 0;
  const headingId = `${sectionId}-judul`;

  return (
    <section
      id={sectionId}
      aria-labelledby={headingId}
      data-dashboard-panel
      className="scroll-mt-20 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2
            id={headingId}
            className="text-base font-semibold text-foreground"
          >
            {title}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {description}
          </p>
        </div>
        <p className="shrink-0 text-xs text-ink-muted">
          <span className="font-semibold text-foreground tabular">
            {formatNumberId(windowTotal)}
          </span>{" "}
          konten / 12 bulan
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {series.map((entry) => (
          <ChartLegendChip
            key={entry.key}
            color={entry.color}
            label={entry.label}
            value={formatNumberId(entry.total)}
          />
        ))}
      </div>

      {!hasData ? (
        <div className="mt-3 flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 text-center text-sm text-ink-muted">
          {emptyMessage}
        </div>
      ) : (
        <>
          <div className="mt-3 h-[240px] w-full" data-monthly-chart>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                barCategoryGap="26%"
                accessibilityLayer
              >
                <CartesianGrid vertical={false} stroke={CHART_GRID} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={6}
                  tick={{ fill: CHART_AXIS, fontSize: 10 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickCount={4}
                  width={36}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: CHART_AXIS, fontSize: 10 }}
                  tickFormatter={(value: number) => formatNumberId(value)}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-muted)", opacity: 0.6 }}
                  content={(props) => (
                    <MonthlyTooltip {...props} series={series} />
                  )}
                />
                {series.map((entry, index) => (
                  <Bar
                    key={entry.key}
                    dataKey={entry.key}
                    name={entry.label}
                    stackId="bulan"
                    fill={entry.color}
                    maxBarSize={28}
                    radius={
                      index === series.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]
                    }
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="sr-only">
            <table>
              <caption>{title}: jumlah konten tervalidasi per bulan</caption>
              <thead>
                <tr>
                  <th scope="col">Bulan</th>
                  {series.map((entry) => (
                    <th key={entry.key} scope="col">
                      {entry.label}
                    </th>
                  ))}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.monthLabel}</th>
                    {series.map((entry) => (
                      <td key={entry.key}>
                        {formatNumberId(Number(row[entry.key] ?? 0))}
                      </td>
                    ))}
                    <td>{formatNumberId(row.monthTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-ink-muted">{footerNote}</p>
    </section>
  );
}

export function MonthlyTrendChart({
  series,
  scopeDescription,
}: {
  series: DashboardMonthlySeries;
  scopeDescription: string;
}) {
  const months = series.points.length
    ? series.points
    : [
        {
          key: series.endKey || "1970-01",
          label: monthAxisLabel(series.endKey || "1970-01"),
          total: 0,
        },
      ];

  return (
    <MonthlyColumnsCard
      sectionId="tren-bulanan"
      title="Tren Bulanan"
      description={`Konten tervalidasi per bulan pada ${scopeDescription}, dihitung dari tanggal disetujui.`}
      months={months}
      series={[
        {
          key: "total",
          label: "Konten tervalidasi",
          color: MONTHLY_TREND_COLOR,
          points: series.points,
          total: series.total,
        },
      ]}
      emptyMessage={`Belum ada konten tervalidasi pada ${scopeDescription} dalam 12 bulan terakhir.`}
    />
  );
}
