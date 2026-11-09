"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import {
  CATEGORY_CHART_COLORS,
  CHART_AXIS,
  CHART_GRID,
  tooltipStyle,
} from "@/lib/chart-theme";
import {
  DASHBOARD_CATEGORIES,
  DASHBOARD_CATEGORY_LABELS,
  type DashboardCategoryTotals,
} from "@/lib/dashboard/types";
import { formatNumberId } from "@/lib/dates";

const BAR_COLOR = "var(--brand-green-700)";
const AGGREGATE_COLOR = "var(--ink-muted)";
const LABEL_WIDTH = 156;
const LABEL_CHARS = 22;
const MAX_LABEL_LINES = 3;
const BAR_SIZE = 14;
const ROW_PITCH = 34;
const CHART_MIN_HEIGHT = 160;
const CHART_MAX_HEIGHT = 380;

export type RankedBarRow = {
  id: string;
  name: string;
  sublabel?: string | null;
  total: number;
  categories: DashboardCategoryTotals;
  aggregate?: boolean;
};

type ChartRow = RankedBarRow & { label: string };

function wrapLabel(
  value: string,
  width = LABEL_CHARS,
  maxLines = MAX_LABEL_LINES,
): string[] {
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
  if (lines.length <= maxLines) return lines;
  const capped = lines.slice(0, maxLines);
  capped[maxLines - 1] = `${capped[maxLines - 1]!.slice(0, width - 1)}…`;
  return capped;
}

type TickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
};

function NameTick({
  x = 0,
  y = 0,
  payload,
  maxLines,
}: TickProps & { maxLines: number }) {
  const lines = wrapLabel(String(payload?.value ?? ""), LABEL_CHARS, maxLines);
  const lineHeight = 12;
  const blockHeight = lines.length * lineHeight;
  const start = y - blockHeight / 2 + lineHeight - 3;

  return (
    <g transform={`translate(${x},0)`}>
      <text textAnchor="end" fill={CHART_AXIS} fontSize={10}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} y={start + index * lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function RowTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  return (
    <div style={tooltipStyle} className="min-w-[200px] px-3 py-2.5">
      <p className="text-xs font-semibold text-foreground">{row.name}</p>
      {row.sublabel ? (
        <p className="mt-0.5 text-xs text-ink-muted">{row.sublabel}</p>
      ) : null}
      <p className="mt-0.5 text-xs text-ink-muted">
        {formatNumberId(row.total)} konten tervalidasi
      </p>
      <ul className="mt-2 space-y-1.5">
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
              {formatNumberId(row.categories[category])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RankedBarChart({
  sectionId,
  title,
  description,
  rows,
  footerNote,
  emptyMessage,
}: {
  sectionId: string;
  title: string;
  description: string;
  rows: RankedBarRow[];
  footerNote?: string | null;
  emptyMessage: string;
}) {
  const sorted = [...rows]
    .filter((row) => row.total > 0 || row.aggregate)
    .sort(
      (left, right) =>
        Number(Boolean(left.aggregate)) - Number(Boolean(right.aggregate)) ||
        right.total - left.total ||
        left.name.localeCompare(right.name, "id"),
    );
  // Dense charts get a two-line label budget so wrapped names cannot overlap
  // inside the fixed 380px canvas.
  const maxLines = Math.min(
    2,
    Math.max(1, ...sorted.map((row) => wrapLabel(row.name).length)),
  );
  const rowHeight = Math.max(ROW_PITCH, maxLines * 12 + 14);
  const height = Math.min(
    CHART_MAX_HEIGHT,
    Math.max(CHART_MIN_HEIGHT, sorted.length * rowHeight + 24),
  );
  const chartRows: ChartRow[] = sorted.map((row) => ({
    ...row,
    label: row.name,
  }));
  const total = sorted.reduce((sum, row) => sum + row.total, 0);
  const namedMax = Math.max(
    1,
    ...sorted.filter((row) => !row.aggregate).map((row) => row.total),
  );
  // Scale the axis to named rows; a large aggregate would otherwise flatten
  // every real bar into a sliver.
  const aggregateClamped = sorted.some(
    (row) => row.aggregate && row.total > namedMax,
  );
  const plotRows = chartRows.map((row) => ({
    ...row,
    plotTotal: row.aggregate ? Math.min(row.total, namedMax) : row.total,
  }));
  const widestValue = Math.max(
    0,
    ...sorted.map((row) => formatNumberId(row.total).length),
  );
  // Value labels sit outside the bar; keep enough right margin that a long
  // total is never clipped by the SVG edge.
  const valueMargin = Math.min(72, Math.max(44, widestValue * 7 + 14));

  return (
    <section
      id={sectionId}
      aria-labelledby={`${sectionId}-judul`}
      data-dashboard-panel
      className="scroll-mt-20 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3
            id={`${sectionId}-judul`}
            className="text-base font-semibold text-foreground"
          >
            {title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {description}
          </p>
        </div>
        <p className="shrink-0 text-xs text-ink-muted">
          <span className="font-semibold text-foreground tabular">
            {formatNumberId(total)}
          </span>{" "}
          konten
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-3 flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 text-center text-sm text-ink-muted">
          {emptyMessage}
        </div>
      ) : (
        <>
          <div
            className="mt-3 max-h-[360px] overflow-y-auto overscroll-contain pr-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            role="region"
            aria-label={`${title}, dapat digulir`}
            tabIndex={0}
          >
            <div style={{ height }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={plotRows}
                  layout="vertical"
                  margin={{
                    top: 4,
                    right: valueMargin,
                    bottom: 0,
                    left: 4,
                  }}
                  barCategoryGap="24%"
                  accessibilityLayer
                >
                  <CartesianGrid horizontal={false} stroke={CHART_GRID} />
                  <XAxis
                    type="number"
                    domain={[0, namedMax]}
                    allowDecimals={false}
                    tickCount={4}
                    tick={{ fill: CHART_AXIS, fontSize: 10 }}
                    tickFormatter={(value: number) => formatNumberId(value)}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={LABEL_WIDTH}
                    tick={<NameTick maxLines={maxLines} />}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--surface-muted)", opacity: 0.6 }}
                    content={RowTooltip}
                  />
                  <Bar
                    dataKey="plotTotal"
                    name="Konten"
                    fill={BAR_COLOR}
                    maxBarSize={BAR_SIZE}
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                  >
                    {chartRows.map((row) => (
                      <Cell
                        key={row.id}
                        fill={row.aggregate ? AGGREGATE_COLOR : BAR_COLOR}
                      />
                    ))}
                    <LabelList
                      dataKey="total"
                      position="right"
                      // The aggregate bar may be clamped; its label still
                      // reports the true total.
                      offset={6}
                      formatter={(value) => formatNumberId(Number(value))}
                      style={{
                        fill: "var(--ink)",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {aggregateClamped ? (
            <p className="mt-1 text-xs text-ink-muted">
              Bar agregat dipotong pada skala tertinggi; nilai sebenarnya
              tertera pada label.
            </p>
          ) : null}

          <div className="sr-only">
            <table>
              <caption>
                {title}: jumlah konten tervalidasi per baris dan kategori
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nama</th>
                  {DASHBOARD_CATEGORIES.map((category) => (
                    <th key={category} scope="col">
                      {DASHBOARD_CATEGORY_LABELS[category]}
                    </th>
                  ))}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {chartRows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.name}</th>
                    {DASHBOARD_CATEGORIES.map((category) => (
                      <td key={category}>
                        {formatNumberId(row.categories[category])}
                      </td>
                    ))}
                    <td>{formatNumberId(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {footerNote ? (
        <p className="mt-3 rounded-md border border-status-review/30 bg-status-review/5 px-3 py-2 text-xs text-ink-muted">
          {footerNote}
        </p>
      ) : null}
    </section>
  );
}
