"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts";

import { ThemeScorecards } from "@/components/dashboard/scorecards";
import { themeChartColor, tooltipStyle } from "@/lib/chart-theme";
import type { DashboardThemeRow } from "@/lib/dashboard/types";
import { formatNumberId } from "@/lib/dates";

type ThemeDatum = {
  key: string;
  name: string;
  value: number;
  percentage: number;
};

function formatPercentage(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function ThemeTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as ThemeDatum | undefined;
  if (!row) return null;
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <p className="text-xs font-semibold text-foreground">{row.name}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {formatNumberId(row.value)} konten · {formatPercentage(row.percentage)}%
      </p>
    </div>
  );
}

export function ThemePanel({
  edufast,
  nonEdufast,
  unclassifiedTheme,
  themes,
}: {
  edufast: number;
  nonEdufast: number;
  unclassifiedTheme: number;
  themes: DashboardThemeRow[];
}) {
  const data: ThemeDatum[] = themes.map((theme) => ({
    key: theme.key,
    name: theme.label,
    value: theme.total,
    percentage: theme.percentage,
  }));
  const hasThemes = nonEdufast > 0 && data.length > 0;

  return (
    <section
      aria-labelledby="tema-konten-judul"
      id="tema-konten"
      className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-surface p-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="tema-konten-judul"
          className="text-sm font-semibold text-foreground"
        >
          Tema Konten
        </h2>
        {unclassifiedTheme > 0 ? (
          <p className="ml-auto rounded-full border border-status-review/30 bg-status-review/5 px-2 py-0.5 text-[10px] text-ink-muted">
            Termasuk {formatNumberId(unclassifiedTheme)} konten tanpa tema
          </p>
        ) : null}
      </div>

      <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[9rem_auto_minmax(0,1fr)] xl:items-center">
        <div className="min-w-0 sm:col-span-2 xl:col-span-1">
          <ThemeScorecards edufast={edufast} nonEdufast={nonEdufast} />
        </div>

        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-foreground">
            Tema Non-EDUFAST
          </h3>
          <p className="text-[10px] text-ink-muted xl:sr-only">
            Sebaran sub-tema dari total konten Non-EDUFAST pada cabang terpilih.
          </p>
          {hasThemes ? (
            <div className="relative mx-auto mt-1 h-[110px] w-[110px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="82%"
                    paddingAngle={1}
                    stroke="var(--surface)"
                    strokeWidth={1}
                    isAnimationActive={false}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={themeChartColor(entry.key, index)}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={ThemeTooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-semibold text-foreground tabular">
                  {formatNumberId(nonEdufast)}
                </p>
                <p className="text-[10px] text-ink-muted">konten</p>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex h-[110px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/40 px-3 text-center text-xs text-ink-muted">
              Belum ada konten Non-EDUFAST pada cabang terpilih.
            </div>
          )}
        </div>

        <div
          className="max-h-[112px] min-w-0 overflow-y-auto overscroll-contain pr-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          role="region"
          aria-label="Legenda tema, dapat digulir"
          tabIndex={0}
        >
          {hasThemes ? (
            <ul className="space-y-0.5">
              {data.map((entry, index) => (
                <li
                  key={entry.key}
                  className="flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-xs odd:bg-surface-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: themeChartColor(entry.key, index),
                      }}
                      aria-hidden
                    />
                    <span
                      className="min-w-0 truncate text-foreground"
                      title={entry.name}
                    >
                      {entry.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-muted tabular">
                    <span className="font-semibold text-foreground">
                      {formatNumberId(entry.value)}
                    </span>{" "}
                    · {formatPercentage(entry.percentage)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {hasThemes ? (
        <div className="sr-only">
          <table>
            <caption>Tema Non-EDUFAST, jumlah konten, dan persentase</caption>
            <thead>
              <tr>
                <th scope="col">Sub-tema</th>
                <th scope="col">Jumlah konten</th>
                <th scope="col">Persentase</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr key={entry.key}>
                  <th scope="row">{entry.name}</th>
                  <td>{formatNumberId(entry.value)}</td>
                  <td>{formatPercentage(entry.percentage)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
