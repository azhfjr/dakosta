"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartFrame, ChartLegendChip } from "@/components/charts/chart-frame";
import { formatNumberId } from "@/lib/dates";
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_LABEL,
  tooltipStyle,
} from "@/lib/chart-theme";

type MixPoint = {
  month: string;
  label: string;
  total: number;
  approved: number;
  video: number;
  infografis: number;
  edufast: number;
  nonEdufast: number;
};

type ThemeRow = {
  mainTheme: string;
  subTheme: string;
  label: string;
  total: number;
  approved: number;
};

type SlaRow = {
  organizationType: string;
  contentType: string;
  samples: number;
  medianDays: number | null;
  averageDays: number | null;
};

type AgingRow = { bucket: string; label: string; total: number };
type FunnelRow = { stage: string; label: string; total: number };
type RankingRow = { id: string; name: string; total: number };
type SourceRow = {
  source: string;
  label: string;
  approved: number;
  submitted: number;
  organizations: number;
};
type EdufastRow = {
  month: string;
  label: string;
  edufast: number;
  nonEdufast: number;
};
type NamedSlice = { key: string; label: string; total: number };
type BenchmarkRow = {
  level: string;
  label: string;
  medianDays: number | null;
  samples: number;
  organizations: number;
  available: boolean;
};

const ORG_TYPE_LABEL: Record<string, string> = {
  FASKES: "Faskes",
  PEMDA: "Pemda",
  OTHER: "Stakeholder/Mitra",
};
const CONTENT_TYPE_LABEL: Record<string, string> = {
  VIDEO: "Video",
  INFOGRAFIS: "Infografis",
};
const SOURCE_COLOR: Record<string, string> = {
  FASKES_FKTP: "var(--chart-1)",
  FASKES_FKRTL: "var(--chart-2)",
  PEMDA: "var(--chart-3)",
  OTHER: "var(--chart-4)",
};

function DataTable({
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
        Lihat tabel data
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
              <tr
                key={String(row[0])}
                className="border-b border-border/60 last:border-0"
              >
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

export function AnalyticsCharts({
  mix,
  themes,
  sla,
  aging,
  funnel,
  rankings,
  rankingLabel = "Peringkat",
  sources,
  edufast,
  platforms,
  benchmarks,
  showAging,
  showEdufast,
  showPlatforms,
  showBenchmarks,
  showSources,
}: {
  mix: MixPoint[];
  themes: ThemeRow[];
  sla: SlaRow[];
  aging: AgingRow[];
  funnel: FunnelRow[];
  rankings: RankingRow[];
  rankingLabel?: string;
  sources: SourceRow[];
  edufast: EdufastRow[];
  platforms: NamedSlice[];
  benchmarks: BenchmarkRow[];
  showAging: boolean;
  showEdufast: boolean;
  showPlatforms: boolean;
  showBenchmarks: boolean;
  showSources: boolean;
}) {
  const mixTotal = mix.reduce((sum, point) => sum + point.total, 0);
  const themeTotal = themes.reduce((sum, row) => sum + row.total, 0);
  const funnelBase = funnel[0]?.total ?? 0;
  const slaData = sla.map((row) => ({
    ...row,
    name: `${ORG_TYPE_LABEL[row.organizationType] ?? row.organizationType} · ${
      CONTENT_TYPE_LABEL[row.contentType] ?? row.contentType
    }`,
  }));
  const benchmarkData = benchmarks.map((row) => ({
    ...row,
    value: row.medianDays ?? 0,
  }));
  const platformTotal = platforms.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartFrame
          title="Tren konten dan capaian"
          description="Konten dibuat per bulan, dengan jumlah disetujui dan komposisi jenis konten."
          unit="konten"
          legend={
            <>
              <ChartLegendChip color="var(--chart-3)" label="Dibuat" />
              <ChartLegendChip
                color="var(--status-approved)"
                label="Disetujui"
              />
            </>
          }
          empty={mixTotal === 0}
          emptyMessage="Belum ada konten pada enam bulan terakhir."
        >
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={mix}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  stroke={CHART_GRID}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={CHART_AXIS}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={CHART_AXIS}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
                />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="total"
                  name="Dibuat"
                  stroke="var(--chart-3)"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="approved"
                  name="Disetujui"
                  stroke="var(--status-approved)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            caption="Tren konten per bulan"
            head={["Bulan", "Dibuat", "Disetujui", "Video", "Infografis"]}
            rows={mix.map((point) => [
              point.label,
              point.total,
              point.approved,
              point.video,
              point.infografis,
            ])}
          />
        </ChartFrame>

        <ChartFrame
          title="Komposisi tema"
          description="Sebaran sub-tema konten dengan porsi yang sudah disetujui."
          unit="konten"
          legend={
            <>
              <ChartLegendChip color="var(--chart-1)" label="Total" />
              <ChartLegendChip
                color="var(--status-approved)"
                label="Disetujui"
              />
            </>
          }
          empty={themeTotal === 0}
        >
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={themes.slice(0, 7)}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
                barGap={2}
              >
                <CartesianGrid
                  stroke={CHART_GRID}
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  stroke={CHART_AXIS}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={112}
                  stroke={CHART_AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="total"
                  name="Total"
                  fill="var(--chart-1)"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="approved"
                  name="Disetujui"
                  fill="var(--status-approved)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            caption="Komposisi tema konten"
            head={["Sub-tema", "Total", "Disetujui"]}
            rows={themes.map((row) => [row.label, row.total, row.approved])}
          />
        </ChartFrame>
      </div>

      {showEdufast ? (
        <ChartFrame
          title="Kepatuhan EDUFAST per bulan"
          description="Konten disetujui pada tema EDUFAST dibanding Non-EDUFAST."
          unit="konten"
          legend={
            <>
              <ChartLegendChip color="var(--chart-1)" label="EDUFAST" />
              <ChartLegendChip color="var(--chart-5)" label="Non-EDUFAST" />
            </>
          }
          empty={edufast.every((row) => row.edufast + row.nonEdufast === 0)}
        >
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={edufast}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  stroke={CHART_GRID}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={CHART_AXIS}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={CHART_AXIS}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  isAnimationActive={false}
                  dataKey="edufast"
                  name="EDUFAST"
                  stackId="a"
                  fill="var(--chart-1)"
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="nonEdufast"
                  name="Non-EDUFAST"
                  stackId="a"
                  fill="var(--chart-5)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartFrame
          title="SLA keputusan"
          description="Median hari dari konten dikirim hingga disetujui, per tipe organisasi dan jenis konten."
          unit="hari"
          empty={slaData.length === 0}
          emptyMessage="Belum ada keputusan disetujui pada periode ini."
        >
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={slaData}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  stroke={CHART_GRID}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke={CHART_AXIS}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={54}
                />
                <YAxis
                  stroke={CHART_AXIS}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  unit="h"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="medianDays"
                  name="Median hari"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="averageDays"
                  name="Rata-rata"
                  fill="var(--chart-3)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            caption="SLA keputusan per tipe organisasi"
            head={["Segmen", "Sampel", "Median hari", "Rata-rata hari"]}
            rows={slaData.map((row) => [
              row.name,
              row.samples,
              row.medianDays ?? "N/A",
              row.averageDays ?? "N/A",
            ])}
          />
        </ChartFrame>

        {showAging ? (
          <ChartFrame
            title="Umur antrean validasi"
            description="Konten menunggu keputusan berdasarkan lama sejak dikirim."
            unit="konten"
            empty={aging.every((row) => row.total === 0)}
            emptyMessage="Tidak ada antrean validasi saat ini."
          >
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={aging}
                  layout="vertical"
                  margin={{ top: 4, right: 20, bottom: 0, left: 12 }}
                >
                  <CartesianGrid
                    stroke={CHART_GRID}
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke={CHART_AXIS}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={86}
                    stroke={CHART_AXIS}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="total"
                    name="Konten"
                    fill="var(--chart-4)"
                    radius={[0, 4, 4, 0]}
                  >
                    {aging.map((row, index) => (
                      <Cell
                        key={row.bucket}
                        fill={
                          index >= 2
                            ? "var(--status-rejected)"
                            : index === 1
                              ? "var(--chart-4)"
                              : "var(--chart-2)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DataTable
              caption="Umur antrean validasi"
              head={["Rentang", "Konten"]}
              rows={aging.map((row) => [row.label, row.total])}
            />
          </ChartFrame>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartFrame
          title="Corong keputusan"
          description="Perjalanan konten dari dibuat hingga disetujui pada periode aktif."
          unit="konten"
          empty={funnelBase === 0}
        >
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnel}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  stroke={CHART_GRID}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={CHART_AXIS}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  stroke={CHART_AXIS}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="total"
                  name="Konten"
                  fill="var(--chart-3)"
                  radius={[4, 4, 0, 0]}
                >
                  {funnel.map((row, index) => (
                    <Cell
                      key={row.stage}
                      fill={
                        [
                          "var(--chart-3)",
                          "var(--chart-2)",
                          "var(--chart-1)",
                          "var(--status-approved)",
                          "var(--status-rejected)",
                        ][index] ?? "var(--chart-3)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Konversi kirim ke setuju:{" "}
            <span className="font-semibold text-foreground tabular">
              {funnel[1]?.total
                ? `${formatNumberId(
                    Math.round(
                      ((funnel[3]?.total ?? 0) / funnel[1].total) * 1000,
                    ) / 10,
                  )}%`
                : "N/A"}
            </span>
          </p>
          <DataTable
            caption="Corong keputusan"
            head={["Tahap", "Konten"]}
            rows={funnel.map((row) => [row.label, row.total])}
          />
        </ChartFrame>

        {showSources ? (
          <ChartFrame
            title="Kontribusi per sumber input"
            description="Konten yang dikirim dan disetujui menurut Faskes FKTP/FKRTL, Pemda, dan Stakeholder."
            unit="konten"
            legend={sources.map((row) => (
              <ChartLegendChip
                key={row.source}
                color={SOURCE_COLOR[row.source] ?? "var(--chart-1)"}
                label={row.label}
              />
            ))}
            empty={sources.length === 0}
          >
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sources}
                  margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
                >
                  <CartesianGrid
                    stroke={CHART_GRID}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    stroke={CHART_AXIS}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    stroke={CHART_AXIS}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="submitted"
                    name="Dikirim"
                    fill="var(--chart-3)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="approved"
                    name="Disetujui"
                    fill="var(--status-approved)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DataTable
              caption="Kontribusi per sumber input"
              head={["Sumber", "Organisasi", "Dikirim", "Disetujui"]}
              rows={sources.map((row) => [
                row.label,
                row.organizations,
                row.submitted,
                row.approved,
              ])}
            />
          </ChartFrame>
        ) : null}
      </div>

      {rankings.length > 0 ? (
        <ChartFrame
          title={rankingLabel}
          description="Konten disetujui terbanyak pada periode aktif."
          unit="konten"
        >
          <div
            className="h-[260px] w-full"
            style={{ height: Math.max(200, rankings.length * 34 + 40) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rankings}
                layout="vertical"
                margin={{ top: 4, right: 20, bottom: 0, left: 16 }}
              >
                <CartesianGrid
                  stroke={CHART_GRID}
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  stroke={CHART_AXIS}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  stroke={CHART_AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="total"
                  name="Disetujui"
                  fill="var(--chart-1)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>
      ) : null}

      {showBenchmarks ? (
        <ChartFrame
          title="Pembanding cohort"
          description="Median hari keputusan organisasi sejenis. Angka hanya tampil bila cohort memiliki minimal tiga organisasi."
          unit="hari"
          empty={
            benchmarkData.length === 0 ||
            benchmarkData.every((row) => !row.available)
          }
          emptyMessage="Data pembanding belum cukup."
        >
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={benchmarkData}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  stroke={CHART_GRID}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={CHART_AXIS}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  stroke={CHART_AXIS}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  unit="h"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
                  formatter={(value, name) => [
                    Number(value) > 0
                      ? `${formatNumberId(Number(value))} hari`
                      : "Belum cukup data",
                    name,
                  ]}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="value"
                  name="Median hari"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            caption="Pembanding cohort"
            head={["Cohort", "Organisasi", "Sampel", "Median hari"]}
            rows={benchmarkData.map((row) => [
              row.label,
              row.organizations,
              row.samples,
              row.available && row.medianDays !== null
                ? `${formatNumberId(row.medianDays)} hari`
                : "Belum cukup data",
            ])}
          />
        </ChartFrame>
      ) : null}

      {showPlatforms ? (
        <ChartFrame
          title="Platform publikasi"
          description="Sebaran platform konten pada periode aktif."
          unit="konten"
          empty={platformTotal === 0}
        >
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={platforms}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  stroke={CHART_GRID}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke={CHART_AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={CHART_AXIS}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_TOOLTIP_LABEL, fontWeight: 600 }}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="total"
                  name="Konten"
                  fill="var(--chart-4)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            caption="Platform publikasi"
            head={["Platform", "Konten"]}
            rows={platforms.map((row) => [row.label, row.total])}
          />
        </ChartFrame>
      ) : null}
    </div>
  );
}
