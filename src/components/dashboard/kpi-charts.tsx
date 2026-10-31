"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumberId } from "@/lib/dates";
import {
  STATUS_LABEL,
  type ContentStatus,
} from "@/lib/content-status";
import type {
  NamedTotal,
  StatusTotal,
  TrendPoint,
} from "@/lib/kpi/formulas";

const STATUS_COLOR: Record<ContentStatus, string> = {
  APPROVED: "#218353",
  SUBMITTED: "#0a78ca",
  IN_REVIEW: "#b46d15",
  REVISION_REQUIRED: "#9a5b12",
  REJECTED: "#b43f42",
  DRAFT: "#8aa0b1",
  REVOKED: "#597184",
  ARCHIVED: "#597184",
};

const GRID = "#e5edf3";
const AXIS = "#597184";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #dbe6ee",
  boxShadow: "0 8px 24px rgba(16, 42, 67, 0.08)",
  fontSize: 12,
} as const;

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function ChartTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-ink-muted select-none">
        Tabel data
      </summary>
      <div className="relative mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border text-ink-muted">
              {head.map((label) => (
                <th key={label} scope="col" className="px-2 py-1.5 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row[0])} className="border-b border-border/60 last:border-0">
                {row.map((cell, index) => (
                  <td
                    key={`${String(row[0])}-${index}`}
                    className="px-2 py-1.5 text-ink-muted tabular"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 text-center text-sm text-ink-muted">
      {message}
    </div>
  );
}

export function KpiCharts({
  trend,
  statusCounts,
  themes,
  stakeholders,
  attributionLabel,
  stakeholderTitle,
}: {
  trend: TrendPoint[];
  statusCounts: StatusTotal[];
  themes: NamedTotal[];
  stakeholders: NamedTotal[];
  attributionLabel: string;
  stakeholderTitle: string;
}) {
  const trendTotal = trend.reduce((sum, point) => sum + point.total, 0);
  const statusData = statusCounts
    .filter((row) => row.total > 0)
    .map((row) => ({
      ...row,
      label: STATUS_LABEL[row.status],
      color: STATUS_COLOR[row.status],
    }));
  const statusTotal = statusData.reduce((sum, row) => sum + row.total, 0);
  const themeTotal = themes.reduce((sum, row) => sum + row.total, 0);
  const stakeholderTotal = stakeholders.reduce((sum, row) => sum + row.total, 0);
  const interval = Math.max(0, Math.ceil(trend.length / 10) - 1);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section
        aria-labelledby="chart-tren"
        className="min-w-0 rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        <h2 id="chart-tren" className="text-base font-semibold text-foreground">
          Tren persetujuan harian
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Berdasarkan {attributionLabel}. Hanya konten berstatus Disetujui.
        </p>
        {trendTotal === 0 ? (
          <EmptyChart message="Belum ada konten disetujui pada periode dan filter ini." />
        ) : (
          <>
            <div className="mt-4 h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0a78ca" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="#0a78ca" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    interval={interval}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: AXIS, fontSize: 11 }}
                    minTickGap={8}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: AXIS, fontSize: 11 }}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "#0f2a43", fontWeight: 600 }}
                    formatter={(value) => [
                      `${formatNumberId(Number(value))} konten`,
                      "Disetujui",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#0a78ca"
                    strokeWidth={2}
                    fill="url(#trendFill)"
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <ChartTable
              caption="Tabel tren persetujuan harian"
              head={["Tanggal", "Disetujui"]}
              rows={trend
                .filter((point) => point.total > 0)
                .map((point) => [point.date, point.total])}
            />
          </>
        )}
      </section>

      <section
        aria-labelledby="chart-status"
        className="min-w-0 rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        <h2 id="chart-status" className="text-base font-semibold text-foreground">
          Distribusi status
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Konten yang dikirim pada periode ini, termasuk yang belum disetujui.
        </p>
        {statusTotal === 0 ? (
          <EmptyChart message="Belum ada konten yang dikirim pada periode ini." />
        ) : (
          <>
            <div className="mt-4 grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <div className="h-[220px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="total"
                    nameKey="label"
                    innerRadius={54}
                    outerRadius={84}
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.status} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [
                      `${formatNumberId(Number(value))} konten`,
                      "Jumlah",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-sm">
              {statusData.map((entry) => (
                <li key={entry.status} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-ink-muted">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                      aria-hidden
                    />
                    <span className="truncate">{entry.label}</span>
                  </span>
                  <span className="font-medium text-foreground tabular">
                    {formatNumberId(entry.total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
            <ChartTable
              caption="Tabel distribusi status konten"
              head={["Status", "Jumlah"]}
              rows={statusData.map((entry) => [entry.label, entry.total])}
            />
          </>
        )}
      </section>

      <section
        aria-labelledby="chart-tema"
        className="min-w-0 rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        <h2 id="chart-tema" className="text-base font-semibold text-foreground">
          Konten disetujui per tema
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Hanya konten Disetujui yang dihitung, sesuai filter yang aktif.
        </p>
        {themeTotal === 0 ? (
          <EmptyChart message="Belum ada konten disetujui per tema pada filter ini." />
        ) : (
          <>
            <div className="mt-4 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={themes}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: AXIS, fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={112}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: AXIS, fontSize: 11 }}
                    tickFormatter={(value: string) => truncate(value, 18)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [
                      `${formatNumberId(Number(value))} konten`,
                      "Disetujui",
                    ]}
                  />
                  <Bar
                    dataKey="total"
                    fill="#04908f"
                    radius={[0, 6, 6, 0]}
                    barSize={16}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartTable
              caption="Tabel konten disetujui per tema"
              head={["Tema", "Disetujui"]}
              rows={themes.map((theme) => [theme.name, theme.total])}
            />
          </>
        )}
      </section>

      <section
        aria-labelledby="chart-stakeholder"
        className="min-w-0 rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        <h2 id="chart-stakeholder" className="text-base font-semibold text-foreground">
          {stakeholderTitle}
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Lima kontributor teratas berdasarkan konten Disetujui.
        </p>
        {stakeholderTotal === 0 ? (
          <EmptyChart message="Belum ada konten disetujui dari stakeholder pada filter ini." />
        ) : (
          <>
            <div className="mt-4 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stakeholders}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: AXIS, fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={124}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: AXIS, fontSize: 11 }}
                    tickFormatter={(value: string) => truncate(value, 20)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [
                      `${formatNumberId(Number(value))} konten`,
                      "Disetujui",
                    ]}
                  />
                  <Bar
                    dataKey="total"
                    fill="#0a78ca"
                    radius={[0, 6, 6, 0]}
                    barSize={16}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartTable
              caption="Tabel peringkat stakeholder berdasarkan konten disetujui"
              head={["Stakeholder", "Disetujui"]}
              rows={stakeholders.map((stakeholder) => [stakeholder.name, stakeholder.total])}
            />
          </>
        )}
      </section>
    </div>
  );
}
