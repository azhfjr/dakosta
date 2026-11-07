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

  return (
    <section aria-labelledby="tema-konten-judul" id="tema-konten">
      <h2
        id="tema-konten-judul"
        className="text-lg font-semibold text-foreground"
      >
        Tema Konten
      </h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ThemeScorecards edufast={edufast} nonEdufast={nonEdufast} />
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Tema Non-EDUFAST
              </h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                Sebaran sub-tema dari total konten Non-EDUFAST pada cabang
                terpilih.
              </p>
            </div>
            {unclassifiedTheme > 0 ? (
              <p className="rounded-full border border-status-review/30 bg-status-review/5 px-2.5 py-1 text-xs text-ink-muted">
                Termasuk {formatNumberId(unclassifiedTheme)} konten tanpa tema
              </p>
            ) : null}
          </div>

          {nonEdufast === 0 || data.length === 0 ? (
            <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 text-center text-sm text-ink-muted">
              Belum ada konten Non-EDUFAST pada cabang terpilih.
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-center">
                <div className="relative h-[230px] w-full">
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
                    <p className="text-2xl font-semibold text-foreground tabular">
                      {formatNumberId(nonEdufast)}
                    </p>
                    <p className="text-xs text-ink-muted">konten</p>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {data.map((entry, index) => (
                    <li
                      key={entry.key}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm odd:bg-surface-muted/50"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: themeChartColor(entry.key, index),
                          }}
                          aria-hidden
                        />
                        <span className="min-w-0 break-words text-foreground">
                          {entry.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-muted tabular">
                        <span className="font-semibold text-foreground">
                          {formatNumberId(entry.value)}
                        </span>{" "}
                        · {formatPercentage(entry.percentage)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sr-only">
                <table>
                  <caption>
                    Tema Non-EDUFAST, jumlah konten, dan persentase
                  </caption>
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}
