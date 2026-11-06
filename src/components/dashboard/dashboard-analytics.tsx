"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartFrame } from "@/components/charts/chart-frame";
import {
  CHART_AXIS,
  CHART_COLORS,
  CHART_GRID,
  CHART_TOOLTIP_LABEL,
  STATUS_CHART_COLOR,
  tooltipStyle,
} from "@/lib/chart-theme";
import { STATUS_LABEL, type ContentStatus } from "@/lib/content-status";
import { formatNumberId } from "@/lib/dates";
import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/taxonomy";
import type {
  DashboardAllContentAnalytics,
  DashboardApprovedAnalytics,
} from "@/lib/analytics/charts";

function count(value: number): string {
  return formatNumberId(value);
}

function ChartTooltip() {
  return (
    <Tooltip
      cursor={{ fill: "var(--surface-muted)", opacity: 0.5 }}
      contentStyle={tooltipStyle}
      labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
      formatter={(value) => count(Number(value))}
    />
  );
}

const ORG_TYPE_LABELS: Record<string, string> = {
  FASKES: "Faskes",
  PEMDA: "Pemda",
  OTHER: "Lainnya",
};

function days(value: number | null): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)} hari`;
}

export function AllContentCharts({
  data,
}: {
  data: DashboardAllContentAnalytics;
}) {
  const statusRows = data.statusCounts.map((row) => ({
    label: STATUS_LABEL[row.status],
    status: row.status,
    total: row.total,
  }));
  const sourceRows = data.sources.map((row) => ({
    label: row.label,
    submitted: row.submitted,
    pending: row.pending,
    approved: row.approved,
  }));
  const slaRows = data.sla.map((row) => ({
    label: `${ORG_TYPE_LABELS[row.organizationType] ?? row.organizationType} · ${
      row.contentType === "UNKNOWN"
        ? "Tanpa jenis"
        : (CONTENT_TYPE_LABELS[row.contentType as ContentType] ??
          row.contentType)
    }`,
    median: row.medianDays ?? 0,
    average: row.averageDays ?? 0,
    samples: row.samples,
  }));
  const funnelRows = data.funnel.stages.map((stage) => ({
    label: stage.label,
    total: stage.total,
  }));
  const funnelEmpty = data.funnel.cohort === 0;

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ChartFrame
        title="Komposisi status konten"
        description="Seluruh konten pada periode · basis tanggal dibuat."
        empty={statusRows.length === 0}
      >
        <ResponsiveContainer
          width="100%"
          height={Math.max(240, statusRows.length * 38)}
        >
          <BarChart
            data={statusRows}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART_GRID} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={116}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <ChartTooltip />
            <Bar dataKey="total" name="Konten" radius={[0, 6, 6, 0]}>
              {statusRows.map((row) => (
                <Cell
                  key={row.status}
                  fill={STATUS_CHART_COLOR[row.status as ContentStatus]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Tren volume pengajuan"
        description="Enam bulan terakhir termasuk periode terpilih · semua status · basis tanggal dibuat."
        legend={
          <>
            <StatusLegend status="DRAFT" />
            <StatusLegend status="SUBMITTED" label="Menunggu" />
            <StatusLegend status="APPROVED" />
            <StatusLegend status="REVISION_REQUIRED" />
            <StatusLegend status="REJECTED" />
          </>
        }
        empty={data.volume.every((point) => point.total === 0)}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data.volume}
            margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke={CHART_GRID} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
              tickLine={false}
              width={36}
            />
            <ChartTooltip />
            <Bar
              dataKey="draft"
              name="Draf"
              stackId="status"
              fill={STATUS_CHART_COLOR.DRAFT}
            />
            <Bar
              dataKey="pending"
              name="Menunggu"
              stackId="status"
              fill={STATUS_CHART_COLOR.SUBMITTED}
            />
            <Bar
              dataKey="approved"
              name="Disetujui"
              stackId="status"
              fill={STATUS_CHART_COLOR.APPROVED}
            />
            <Bar
              dataKey="revision"
              name="Perlu revisi"
              stackId="status"
              fill={STATUS_CHART_COLOR.REVISION_REQUIRED}
            />
            <Bar
              dataKey="rejected"
              name="Ditolak"
              stackId="status"
              fill={STATUS_CHART_COLOR.REJECTED}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Jenis konten"
        description="Seluruh konten pada periode · basis tanggal dibuat."
        empty={data.types.length === 0}
      >
        <ResponsiveContainer
          width="100%"
          height={Math.max(200, data.types.length * 44)}
        >
          <BarChart
            data={data.types}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART_GRID} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={104}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <ChartTooltip />
            <Bar
              dataKey="total"
              name="Konten"
              fill={CHART_COLORS[0]}
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Platform unggahan"
        description="Seluruh konten pada periode, termasuk yang belum disetujui · basis tanggal dibuat."
        empty={data.platforms.length === 0}
      >
        <ResponsiveContainer
          width="100%"
          height={Math.max(200, data.platforms.length * 38)}
        >
          <BarChart
            data={data.platforms}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART_GRID} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={104}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <ChartTooltip />
            <Bar
              dataKey="total"
              name="Konten"
              fill={CHART_COLORS[1]}
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Umur antrean validasi"
        description="Konten yang saat ini menunggu keputusan · dihitung dari tanggal dikirim."
        empty={data.aging.every((bucket) => bucket.total === 0)}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data.aging.map((bucket) => ({
              label: bucket.label,
              total: bucket.total,
            }))}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART_GRID} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={96}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <ChartTooltip />
            <Bar
              dataKey="total"
              name="Konten"
              fill={CHART_COLORS[2]}
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Corong keputusan"
        description="Kohort konten yang dibuat pada periode · setiap tahap adalah bagian dari tahap sebelumnya."
        empty={funnelEmpty}
        emptyMessage="Belum ada konten yang dibuat pada filter ini."
      >
        <ResponsiveContainer
          width="100%"
          height={Math.max(200, funnelRows.length * 44)}
        >
          <BarChart
            data={funnelRows}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART_GRID} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={116}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <ChartTooltip />
            <Bar
              dataKey="total"
              name="Konten"
              fill={CHART_COLORS[3]}
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.funnel.outcomes.map((outcome) => (
            <span
              key={outcome.stage}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-xs text-ink-muted"
            >
              {outcome.label}
              <span className="font-semibold text-foreground tabular">
                {count(outcome.total)}
              </span>
            </span>
          ))}
        </div>
      </ChartFrame>

      <ChartFrame
        title="Kontribusi sumber"
        description="Konten yang dibuat pada periode · dikirim, menunggu, dan disetujui dihitung terpisah."
        empty={sourceRows.length === 0}
      >
        <ResponsiveContainer
          width="100%"
          height={Math.max(240, sourceRows.length * 52)}
        >
          <BarChart
            data={sourceRows}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART_GRID} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={116}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-muted)", opacity: 0.5 }}
              contentStyle={tooltipStyle}
              labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
              formatter={(value) => count(Number(value))}
            />
            <Legend />
            <Bar
              dataKey="submitted"
              name="Dikirim"
              fill={CHART_COLORS[0]}
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="pending"
              name="Menunggu"
              fill={STATUS_CHART_COLOR.SUBMITTED}
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="approved"
              name="Disetujui"
              fill={STATUS_CHART_COLOR.APPROVED}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="SLA keputusan (operasional)"
        description="Indikator operasional, bukan capaian · hari dari dikirim sampai disetujui · hanya konten yang disetujui pada periode."
        empty={slaRows.length === 0}
        legend={
          <>
            <LegendChip color={CHART_COLORS[3]} label="Median" />
            <LegendChip color={CHART_COLORS[4]} label="Rata-rata" />
          </>
        }
      >
        <ResponsiveContainer
          width="100%"
          height={Math.max(240, slaRows.length * 44)}
        >
          <BarChart
            data={slaRows}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART_GRID} />
            <XAxis
              type="number"
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
              unit=" hari"
            />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <ChartTooltip />
            <Bar
              dataKey="median"
              name="Median"
              fill={CHART_COLORS[3]}
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="average"
              name="Rata-rata"
              fill={CHART_COLORS[4]}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {data.sla.map((row) => (
            <li key={`${row.organizationType}-${row.contentType}`}>
              {ORG_TYPE_LABELS[row.organizationType] ?? row.organizationType} ·{" "}
              {row.contentType === "UNKNOWN"
                ? "Tanpa jenis"
                : (CONTENT_TYPE_LABELS[row.contentType as ContentType] ??
                  row.contentType)}
              : {days(row.medianDays)} · {count(row.samples)} sampel
            </li>
          ))}
        </ul>
      </ChartFrame>
    </div>
  );
}

function StatusLegend({
  status,
  label,
}: {
  status: ContentStatus;
  label?: string;
}) {
  return (
    <LegendChip
      color={STATUS_CHART_COLOR[status]}
      label={label ?? STATUS_LABEL[status]}
    />
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-xs text-ink-muted">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function ApprovedCharts({
  data,
  target,
}: {
  data: DashboardApprovedAnalytics;
  target: { approved: number; target: number | null } | null;
}) {
  const benchmarkRows = data.benchmarks.filter((row) => row.available);
  const unavailableCohorts = data.benchmarks.filter((row) => !row.available);
  const targetRows =
    target && target.target !== null
      ? [
          { label: "Realisasi", total: target.approved },
          { label: "Target", total: target.target },
        ]
      : [];

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ChartFrame
        title="Tren persetujuan"
        description="Enam bulan terakhir termasuk periode terpilih · hanya status Disetujui · basis tanggal disetujui."
        empty={data.approvals.every((point) => point.total === 0)}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart
            data={data.approvals}
            margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
          >
            <defs>
              <linearGradient id="approvedFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={STATUS_CHART_COLOR.APPROVED}
                  stopOpacity={0.35}
                />
                <stop
                  offset="100%"
                  stopColor={STATUS_CHART_COLOR.APPROVED}
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART_GRID} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
              tickLine={false}
              width={36}
            />
            <ChartTooltip />
            <Area
              type="monotone"
              dataKey="total"
              name="Disetujui"
              stroke={STATUS_CHART_COLOR.APPROVED}
              strokeWidth={2}
              fill="url(#approvedFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Realisasi vs target periode"
        description="Konten disetujui pada periode dibandingkan target resmi role Anda."
        empty={targetRows.length === 0}
        emptyMessage="Target belum ditetapkan untuk kombinasi filter ini."
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={targetRows}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART_GRID} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={96}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <ChartTooltip />
            <Bar dataKey="total" name="Konten" radius={[0, 6, 6, 0]}>
              {targetRows.map((row) => (
                <Cell
                  key={row.label}
                  fill={
                    row.label === "Target"
                      ? CHART_COLORS[0]
                      : STATUS_CHART_COLOR.APPROVED
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title={data.rankingLabel}
        description="Konten disetujui pada periode · basis tanggal disetujui · delapan teratas."
        empty={data.rankings.length === 0}
      >
        <ResponsiveContainer
          width="100%"
          height={Math.max(240, data.rankings.length * 40)}
        >
          <BarChart
            data={data.rankings.map((row) => ({
              label: row.name,
              total: row.total,
            }))}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART_GRID} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <ChartTooltip />
            <Bar
              dataKey="total"
              name="Disetujui"
              fill={STATUS_CHART_COLOR.APPROVED}
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Kepatuhan EDUFAST"
        description="Konten disetujui per bulan, dipisahkan tema EDUFAST dan Non-EDUFAST."
        legend={
          <>
            <LegendChip color={CHART_COLORS[0]} label="EDUFAST" />
            <LegendChip color={CHART_COLORS[1]} label="Non-EDUFAST" />
          </>
        }
        empty={data.edufast.every(
          (point) => point.edufast === 0 && point.nonEdufast === 0,
        )}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data.edufast}
            margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke={CHART_GRID} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
              tickLine={false}
              width={36}
            />
            <ChartTooltip />
            <Bar
              dataKey="edufast"
              name="EDUFAST"
              stackId="theme"
              fill={CHART_COLORS[0]}
            />
            <Bar
              dataKey="nonEdufast"
              name="Non-EDUFAST"
              stackId="theme"
              fill={CHART_COLORS[1]}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Jenis konten disetujui"
        description="Hanya status Disetujui · basis tanggal disetujui."
        empty={data.types.length === 0}
      >
        <ResponsiveContainer
          width="100%"
          height={Math.max(200, data.types.length * 44)}
        >
          <BarChart
            data={data.types}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART_GRID} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={104}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <ChartTooltip />
            <Bar
              dataKey="total"
              name="Disetujui"
              fill={STATUS_CHART_COLOR.APPROVED}
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Platform publikasi"
        description="Hanya konten disetujui · basis tanggal disetujui."
        empty={data.platforms.length === 0}
      >
        <ResponsiveContainer
          width="100%"
          height={Math.max(200, data.platforms.length * 38)}
        >
          <BarChart
            data={data.platforms}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <CartesianGrid horizontal={false} stroke={CHART_GRID} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={104}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <ChartTooltip />
            <Bar
              dataKey="total"
              name="Disetujui"
              fill={CHART_COLORS[2]}
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      {data.benchmarks.length > 0 ? (
        <ChartFrame
          title="Kecepatan validasi vs pembanding"
          description="Median hari dari dikirim sampai disetujui pada periode."
          empty={benchmarkRows.length === 0}
          emptyMessage="Belum ada sampel disetujui pada pembanding mana pun."
        >
          <ResponsiveContainer
            width="100%"
            height={Math.max(200, benchmarkRows.length * 44)}
          >
            <BarChart
              data={benchmarkRows.map((row) => ({
                label: row.label,
                median: row.medianDays ?? 0,
              }))}
              layout="vertical"
              margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
            >
              <CartesianGrid horizontal={false} stroke={CHART_GRID} />
              <XAxis
                type="number"
                tick={{ fill: CHART_AXIS, fontSize: 12 }}
                unit=" hari"
              />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fill: CHART_AXIS, fontSize: 12 }}
              />
              <ChartTooltip />
              <Bar
                dataKey="median"
                name="Median hari"
                fill={CHART_COLORS[3]}
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          {unavailableCohorts.length > 0 ? (
            <p className="mt-3 text-xs text-ink-muted">
              Belum ada sampel:{" "}
              {unavailableCohorts.map((row) => row.label).join(", ")}.
            </p>
          ) : null}
        </ChartFrame>
      ) : null}
    </div>
  );
}
