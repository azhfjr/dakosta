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
  CATEGORY_CHART_COLORS,
  CHART_AXIS,
  CHART_GRID,
  tooltipStyle,
} from "@/lib/chart-theme";
import {
  DASHBOARD_CATEGORIES,
  DASHBOARD_CATEGORY_LABELS,
  type DashboardBranchRow,
} from "@/lib/dashboard/types";
import { formatNumberId } from "@/lib/dates";

const LABEL_WIDTH = 132;
const LABEL_CHARS = 15;

type ChartRow = {
  id: string;
  label: string;
  name: string;
  total: number;
  FKRTL: number;
  FKTP: number;
  PEMDA: number;
  STAKEHOLDER: number;
};

function wrapLabel(value: string, width = LABEL_CHARS): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["Tanpa nama"];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= width) {
      current = word;
    } else {
      for (let index = 0; index < word.length; index += width) {
        lines.push(word.slice(index, index + width));
      }
      current = "";
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ["Tanpa nama"];
}

type TickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
};

function BranchTick({ x = 0, y = 0, payload }: TickProps) {
  const raw = String(payload?.value ?? "");
  const separator = raw.indexOf("\u0000");
  const name = separator >= 0 ? raw.slice(0, separator) : raw;
  const total = separator >= 0 ? raw.slice(separator + 1) : "";
  const lines = wrapLabel(name);
  const lineHeight = 12;
  const blockHeight = lines.length * lineHeight + lineHeight;
  const start = y - blockHeight / 2 + lineHeight - 2;

  return (
    <g transform={`translate(${x},0)`}>
      <text textAnchor="end" fill={CHART_AXIS} fontSize={11}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} y={start + index * lineHeight}>
            {line}
          </tspan>
        ))}
        <tspan
          x={0}
          y={start + lines.length * lineHeight}
          fill="var(--ink)"
          fontWeight={600}
        >
          {total ? `${total} konten` : ""}
        </tspan>
      </text>
    </g>
  );
}

function BranchTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  return (
    <div style={tooltipStyle} className="min-w-[190px] px-3 py-2.5">
      <p className="text-xs font-semibold text-foreground">{row.name}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {formatNumberId(row.total)} konten tervalidasi
      </p>
      <ul className="mt-2 space-y-1">
        {DASHBOARD_CATEGORIES.map((category) => (
          <li
            key={category}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: CATEGORY_CHART_COLORS[category] }}
                aria-hidden
              />
              {DASHBOARD_CATEGORY_LABELS[category]}
            </span>
            <span className="font-semibold text-foreground tabular">
              {formatNumberId(row[category])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BranchStackChart({
  branches,
  unassignedApproved,
}: {
  branches: DashboardBranchRow[];
  unassignedApproved: number;
}) {
  const maxLines = Math.max(
    1,
    ...branches.map((branch) => wrapLabel(branch.name).length),
  );
  const rowHeight = Math.max(28, maxLines * 12 + 14);
  const height = Math.max(120, branches.length * rowHeight + 8);
  const rows: ChartRow[] = branches.map((branch) => ({
    id: branch.id,
    label: `${branch.name}\u0000${formatNumberId(branch.total)}`,
    name: branch.name,
    total: branch.total,
    FKRTL: branch.categories.FKRTL,
    FKTP: branch.categories.FKTP,
    PEMDA: branch.categories.PEMDA,
    STAKEHOLDER: branch.categories.STAKEHOLDER,
  }));
  const totalApproved = branches.reduce((sum, branch) => sum + branch.total, 0);

  return (
    <section
      id="konten-per-cabang"
      aria-labelledby="konten-per-cabang-judul"
      className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-surface p-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="konten-per-cabang-judul"
          className="text-base font-semibold text-foreground xl:text-sm"
        >
          Konten per Cabang
        </h2>
        <div className="flex flex-wrap gap-1">
          {DASHBOARD_CATEGORIES.map((category) => (
            <ChartLegendChip
              key={category}
              color={CATEGORY_CHART_COLORS[category]}
              label={DASHBOARD_CATEGORY_LABELS[category]}
            />
          ))}
        </div>
        <p className="w-full text-xs text-ink-muted xl:sr-only">
          Hanya konten dengan approval final, diurutkan dari total tertinggi.
        </p>
      </div>

      {branches.length === 0 ? (
        <div className="mt-2 flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 text-center text-sm text-ink-muted">
          Belum ada cabang dalam cakupan Anda.
        </div>
      ) : (
        <>
          <div
            className="mt-2 max-h-[240px] overflow-y-auto overscroll-contain pr-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none xl:max-h-[132px]"
            role="region"
            aria-label="Grafik konten per cabang, dapat digulir"
            tabIndex={0}
          >
            <div style={{ height }} className="min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rows}
                  layout="vertical"
                  margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
                  accessibilityLayer
                >
                  <CartesianGrid horizontal={false} stroke={CHART_GRID} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: CHART_AXIS, fontSize: 11 }}
                    tickFormatter={(value: number) => formatNumberId(value)}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={LABEL_WIDTH}
                    tick={<BranchTick />}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--surface-muted)", opacity: 0.6 }}
                    content={BranchTooltip}
                  />
                  {DASHBOARD_CATEGORIES.map((category) => (
                    <Bar
                      key={category}
                      dataKey={category}
                      name={DASHBOARD_CATEGORY_LABELS[category]}
                      stackId="konten"
                      fill={CATEGORY_CHART_COLORS[category]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {totalApproved === 0 ? (
            <p className="mt-2 text-xs text-ink-muted">
              Belum ada konten tervalidasi pada cabang dalam cakupan Anda.
            </p>
          ) : null}
        </>
      )}

      {unassignedApproved > 0 ? (
        <p className="mt-2 rounded-md border border-status-review/30 bg-status-review/5 px-2 py-1 text-[11px] text-ink-muted">
          {formatNumberId(unassignedApproved)} konten tervalidasi belum
          terhubung ke cabang dan tidak tampil pada grafik ini.
        </p>
      ) : null}

      {branches.length > 0 ? (
        <div className="sr-only">
          <table>
            <caption>Konten tervalidasi per cabang dan kategori</caption>
            <thead>
              <tr>
                <th scope="col">Cabang</th>
                {DASHBOARD_CATEGORIES.map((category) => (
                  <th key={category} scope="col">
                    {DASHBOARD_CATEGORY_LABELS[category]}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id}>
                  <th scope="row">{branch.name}</th>
                  {DASHBOARD_CATEGORIES.map((category) => (
                    <td key={category}>
                      {formatNumberId(branch.categories[category])}
                    </td>
                  ))}
                  <td>{formatNumberId(branch.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
