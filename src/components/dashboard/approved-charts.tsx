"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartFrame, ChartLegendChip } from "@/components/charts/chart-frame";
import {
  CHART_AXIS,
  CHART_COLORS,
  CHART_GRID,
  CHART_TOOLTIP_LABEL,
  STATUS_CHART_COLOR,
  tooltipStyle,
} from "@/lib/chart-theme";
import { formatNumberId } from "@/lib/dates";
import type {
  DashboardBranchAchievement,
  DashboardBreakdownRow,
  DashboardMonthlyPoint,
  DashboardSubThemeRow,
  DashboardThemePoint,
  DashboardTypePlatform,
  DashboardTypePlatformPoint,
} from "@/lib/analytics/dashboard";

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

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg border border-border bg-surface-muted/60 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            value === option.value
              ? "bg-surface text-foreground shadow-sm"
              : "text-ink-muted hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function BranchAchievementChart({
  data,
}: {
  data: DashboardBranchAchievement;
}) {
  return (
    <ChartFrame
      title="Pencapaian Konten per Kantor Cabang"
      description="Konten dengan approval final di wilayah Anda, diurutkan dari capaian tertinggi. Angka hanya menghitung status Disetujui."
      empty={data.rows.length === 0}
      emptyMessage="Belum ada konten disetujui pada cabang di wilayah ini."
    >
      <ResponsiveContainer
        width="100%"
        height={Math.max(240, data.rows.length * 40)}
      >
        <BarChart
          data={data.rows.map((row) => ({
            label: row.name,
            total: row.approved,
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
            width={168}
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
  );
}

export function MonthlyTrendChart({ data }: { data: DashboardMonthlyPoint[] }) {
  const [window, setWindow] = useState<12 | 24>(12);
  const points = useMemo(() => data.slice(-window), [data, window]);
  const empty = points.every((point) => point.total === 0);

  return (
    <ChartFrame
      title="Tren Persetujuan per Bulan"
      description="Jumlah konten yang disetujui pada setiap bulan, berdasarkan tanggal approval final di Asia/Jakarta. Bulan tanpa persetujuan ditampilkan sebagai nol."
      actions={
        <Segmented
          label="Rentang tren bulanan"
          value={String(window) as "12" | "24"}
          onChange={(value) => setWindow(value === "24" ? 24 : 12)}
          options={[
            { value: "12", label: "12 bulan" },
            { value: "24", label: "24 bulan" },
          ]}
        />
      }
      legend={
        <ChartLegendChip
          color={STATUS_CHART_COLOR.APPROVED}
          label="Disetujui"
        />
      }
      empty={empty}
      emptyMessage="Belum ada persetujuan pada rentang bulan ini."
    >
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={points}
          margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
        >
          <defs>
            <linearGradient
              id="approved-monthly-fill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
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
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: CHART_AXIS, fontSize: 12 }}
            tickLine={false}
            width={40}
          />
          <ChartTooltip />
          <Area
            type="monotone"
            dataKey="total"
            name="Disetujui"
            stroke={STATUS_CHART_COLOR.APPROVED}
            strokeWidth={2}
            fill="url(#approved-monthly-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function ThemeSubthemeTrend({
  monthly,
  subThemes,
}: {
  monthly: DashboardThemePoint[];
  subThemes: DashboardSubThemeRow[];
}) {
  const [mode, setMode] = useState<"theme" | "subtheme">("theme");
  const [window, setWindow] = useState<12 | 24>(12);
  const points = useMemo(() => monthly.slice(-window), [monthly, window]);
  const themeEmpty = points.every(
    (point) => point.edufast === 0 && point.nonEdufast === 0,
  );
  const subThemeRows = subThemes.filter((row) => row.total > 0 || !row.orphan);
  const subThemeEmpty = subThemeRows.every((row) => row.total === 0);

  return (
    <ChartFrame
      title="Tren per Tema dan Sub-tema"
      description={
        mode === "theme"
          ? "Konten disetujui per bulan, dipisahkan tema utama EDUFAST dan Non-EDUFAST."
          : "Total konten disetujui menurut sub-tema pada rentang yang dipilih. Sub-tema tanpa pemetaan sah dikelompokkan terpisah."
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Tampilan tema"
            value={mode}
            onChange={setMode}
            options={[
              { value: "theme", label: "Tema utama" },
              { value: "subtheme", label: "Sub-tema" },
            ]}
          />
          {mode === "theme" ? (
            <Segmented
              label="Rentang tren tema"
              value={String(window) as "12" | "24"}
              onChange={(value) => setWindow(value === "24" ? 24 : 12)}
              options={[
                { value: "12", label: "12 bulan" },
                { value: "24", label: "24 bulan" },
              ]}
            />
          ) : null}
        </div>
      }
      legend={
        mode === "theme" ? (
          <>
            <ChartLegendChip color={CHART_COLORS[0]} label="EDUFAST" />
            <ChartLegendChip color={CHART_COLORS[1]} label="Non-EDUFAST" />
          </>
        ) : undefined
      }
      empty={mode === "theme" ? themeEmpty : subThemeEmpty}
      emptyMessage="Belum ada konten disetujui pada rentang tema ini."
    >
      {mode === "theme" ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={points}
            margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke={CHART_GRID} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
              tickLine={false}
              width={40}
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
      ) : (
        <ResponsiveContainer
          width="100%"
          height={Math.max(240, subThemeRows.length * 42)}
        >
          <BarChart
            data={subThemeRows.map((row) => ({
              label: row.label,
              total: row.total,
              orphan: row.orphan,
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
              width={176}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
            />
            <ChartTooltip />
            <Bar dataKey="total" name="Disetujui" radius={[0, 6, 6, 0]}>
              {subThemeRows.map((row) => (
                <Cell
                  key={row.key}
                  fill={row.orphan ? CHART_COLORS[3] : CHART_COLORS[0]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

function breakdownRows(
  points: DashboardTypePlatformPoint[],
  field: "types" | "platforms",
): { key: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const point of points) {
    for (const [key, value] of Object.entries(point[field])) {
      totals.set(key, (totals.get(key) ?? 0) + value);
    }
  }
  return [...totals.entries()].map(([key, total]) => ({ key, total }));
}

export function TypePlatformTrend({ data }: { data: DashboardTypePlatform }) {
  const [mode, setMode] = useState<"type" | "platform">("type");
  const [window, setWindow] = useState<12 | 24>(12);
  const points = useMemo(
    () => data.monthly.slice(-window),
    [data.monthly, window],
  );
  const empty = points.every((point) => point.total === 0);

  const keys = useMemo(() => {
    const field = mode === "type" ? "types" : "platforms";
    const source = mode === "type" ? data.types : data.platforms;
    const present = new Set(breakdownRows(points, field).map((row) => row.key));
    return source.filter((row) => present.has(row.key));
  }, [data.platforms, data.types, mode, points]);

  const breakdownSource: DashboardBreakdownRow[] =
    mode === "type" ? data.types : data.platforms;

  return (
    <ChartFrame
      title="Tren per Jenis Konten dan Platform"
      description={
        mode === "type"
          ? "Konten disetujui per bulan menurut jenis konten. Setiap konten unik dihitung satu kali."
          : "Konten disetujui per bulan menurut platform yang tercatat. Setiap konten unik dihitung satu kali pada platformnya; konten multi-platform tidak dipecah ke beberapa platform."
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Tampilan jenis atau platform"
            value={mode}
            onChange={setMode}
            options={[
              { value: "type", label: "Jenis konten" },
              { value: "platform", label: "Platform" },
            ]}
          />
          <Segmented
            label="Rentang tren jenis dan platform"
            value={String(window) as "12" | "24"}
            onChange={(value) => setWindow(value === "24" ? 24 : 12)}
            options={[
              { value: "12", label: "12 bulan" },
              { value: "24", label: "24 bulan" },
            ]}
          />
        </div>
      }
      legend={
        <>
          {keys.map((row, index) => (
            <ChartLegendChip
              key={row.key}
              color={CHART_COLORS[index % CHART_COLORS.length]}
              label={row.label}
              value={count(row.total)}
            />
          ))}
        </>
      }
      empty={empty}
      emptyMessage="Belum ada konten disetujui pada rentang ini."
    >
      <div className="space-y-6">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={points}
            margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke={CHART_GRID} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: CHART_AXIS, fontSize: 12 }}
              tickLine={false}
              width={40}
            />
            <ChartTooltip />
            {keys.map((row, index) => (
              <Bar
                key={row.key}
                dataKey={
                  mode === "type" ? `types.${row.key}` : `platforms.${row.key}`
                }
                name={row.label}
                stackId={mode}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                radius={index === keys.length - 1 ? [6, 6, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>

        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Total menurut {mode === "type" ? "jenis konten" : "platform"}
          </h3>
          <ResponsiveContainer
            width="100%"
            height={Math.max(180, breakdownSource.length * 40)}
          >
            <BarChart
              data={breakdownSource}
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
                width={144}
                tick={{ fill: CHART_AXIS, fontSize: 12 }}
              />
              <ChartTooltip />
              <Bar
                dataKey="total"
                name="Disetujui"
                fill={mode === "type" ? CHART_COLORS[0] : CHART_COLORS[2]}
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartFrame>
  );
}
