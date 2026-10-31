import Link from "next/link";
import { FileText, Gauge, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ORG_SOURCES,
  ORG_SOURCE_LABELS,
  type AnalyticsSourceOption,
  type OrgSource,
} from "@/lib/analytics/source";
import { formatNumberId } from "@/lib/dates";
import { monthOptions } from "@/lib/kpi/sql";
import type { KpiFilters } from "@/lib/kpi/formulas";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export type AnalyticsFilterState = KpiFilters & { sources: OrgSource[] };

export function reportHrefFor(
  filters: AnalyticsFilterState,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams();
  params.set("month", filters.month);
  params.set("attribution", filters.attribution);
  if (filters.stakeholderId) params.set("stakeholderId", filters.stakeholderId);
  if (filters.subTheme) params.set("subTheme", filters.subTheme);
  if (filters.sources.length > 0) params.set("source", filters.sources.join(","));
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `/api/v1/reports/achievement?${params.toString()}`;
}

export function AnalyticsFilterBar({
  action,
  filters,
  sourceOptions,
  stakeholders = [],
  themes = [],
  showStakeholder = false,
  showTheme = true,
  showSources = true,
  periodLabel,
  attributionLabel,
}: {
  action: string;
  filters: AnalyticsFilterState;
  sourceOptions: AnalyticsSourceOption[];
  stakeholders?: Array<{ id: string; name: string }>;
  themes?: Array<{ id: string; name: string }>;
  showStakeholder?: boolean;
  showTheme?: boolean;
  showSources?: boolean;
  periodLabel: string;
  attributionLabel: string;
}) {
  return (
    <section
      aria-label="Filter analitik"
      className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <form method="get" action={action} className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Gauge className="size-4 text-brand-green-700" aria-hidden />
          Filter analitik
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label
              htmlFor="analitik-month"
              className="text-xs font-medium text-ink-muted"
            >
              Periode bulan
            </label>
            <select
              id="analitik-month"
              name="month"
              defaultValue={filters.month}
              className={selectClass}
            >
              {monthOptions(filters.month).map((month) => (
                <option key={month.key} value={month.key}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          {showStakeholder ? (
            <div className="space-y-1.5">
              <label
                htmlFor="analitik-stakeholder"
                className="text-xs font-medium text-ink-muted"
              >
                Stakeholder
              </label>
              <select
                id="analitik-stakeholder"
                name="stakeholderId"
                defaultValue={filters.stakeholderId ?? ""}
                className={selectClass}
              >
                <option value="">Semua stakeholder</option>
                {stakeholders.map((stakeholder) => (
                  <option key={stakeholder.id} value={stakeholder.id}>
                    {stakeholder.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {showTheme ? (
            <div className="space-y-1.5">
              <label
                htmlFor="analitik-theme"
                className="text-xs font-medium text-ink-muted"
              >
                Sub-tema
              </label>
              <select
                id="analitik-theme"
                name="subTheme"
                defaultValue={filters.subTheme ?? ""}
                className={selectClass}
              >
                <option value="">Semua tema</option>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <label
              htmlFor="analitik-attribution"
              className="text-xs font-medium text-ink-muted"
            >
              Dasar tanggal capaian
            </label>
            <select
              id="analitik-attribution"
              name="attribution"
              defaultValue={filters.attribution}
              className={selectClass}
            >
              <option value="approved_at">Tanggal disetujui</option>
              <option value="date_created">Tanggal konten dibuat</option>
            </select>
          </div>
        </div>
        {showSources ? (
          <fieldset className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-surface-muted/40 px-3 py-2">
            <legend className="px-1 text-xs font-medium text-ink-muted">
              Sumber input
            </legend>
            {ORG_SOURCES.map((source) => {
              const option = sourceOptions.find((item) => item.source === source);
              return (
                <label
                  key={source}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-muted"
                >
                  <input
                    type="checkbox"
                    name="source"
                    value={source}
                    defaultChecked={filters.sources.includes(source)}
                    className="size-3.5 rounded border-input accent-[var(--brand-green-700)]"
                  />
                  {ORG_SOURCE_LABELS[source]}
                  {option ? (
                    <span className="text-ink-muted/70">
                      ({formatNumberId(option.organizations)})
                    </span>
                  ) : null}
                </label>
              );
            })}
          </fieldset>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" className="h-9">
            Terapkan filter
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href={action}>
              <RotateCcw className="size-4" aria-hidden />
              Atur ulang
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-9">
            <a href={reportHrefFor(filters)} download>
              <FileText className="size-4" aria-hidden />
              Unduh laporan PDF
            </a>
          </Button>
          <p className="text-xs text-ink-muted">
            {periodLabel} · dasar {attributionLabel}
          </p>
        </div>
      </form>
    </section>
  );
}
