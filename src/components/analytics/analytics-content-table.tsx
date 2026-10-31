import Link from "next/link";
import {
  ArrowDownWideNarrow,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Search,
} from "lucide-react";

import { ContentTypeBadge } from "@/components/content/content-type-badge";
import { StatusBadge } from "@/components/content/status-badge";
import { Button } from "@/components/ui/button";
import {
  ANALYTICS_PERIOD_LABEL,
  ANALYTICS_SORT_LABELS,
  ANALYTICS_TABLE_PAGE_SIZE,
  type AnalyticsContentFilters,
  type AnalyticsContentPage,
} from "@/lib/analytics/content-table";
import {
  ORG_SOURCES,
  ORG_SOURCE_LABELS,
  type AnalyticsSourceOption,
} from "@/lib/analytics/source";
import {
  CONTENT_STATUSES,
  PLATFORM_LABEL,
  STATUS_LABEL,
} from "@/lib/content-status";
import { formatDateId, formatDateTimeId, formatNumberId } from "@/lib/dates";
import { monthKeyFor } from "@/lib/kpi/formulas";
import { monthOptions } from "@/lib/kpi/sql";
import { SUB_THEME_LABELS, type SubTheme } from "@/lib/taxonomy";

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const ROLE_LABEL: Record<string, string> = {
  MASTER_ADMIN: "Master",
  REGIONAL_ADMIN: "Wilayah",
  BRANCH_ADMIN: "Cabang",
};

function buildHref(
  action: string,
  filters: AnalyticsContentFilters,
  overrides: Partial<AnalyticsContentFilters> & { page?: number } = {},
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (merged.period !== "ALL") params.set("period", merged.period);
  if (merged.status !== "ALL") params.set("status", merged.status);
  if (merged.decidedBy !== "ANY") params.set("decidedBy", merged.decidedBy);
  if (merged.sort !== "recent") params.set("sort", merged.sort);
  if (merged.search) params.set("q", merged.search);
  if (merged.sources.length > 0) params.set("source", merged.sources.join(","));
  if ((merged.page ?? 1) > 1) params.set("page", String(merged.page ?? 1));
  const query = params.toString();
  return query ? `${action}?${query}` : action;
}

function sourceClass(source: string): string {
  switch (source) {
    case "FASKES_FKTP":
      return "border-brand-green-500/30 bg-brand-green-100 text-brand-green-700";
    case "FASKES_FKRTL":
      return "border-brand-teal-500/30 bg-brand-teal-100 text-brand-teal-700";
    case "PEMDA":
      return "border-brand-blue-500/30 bg-brand-blue-100 text-brand-blue-700";
    default:
      return "border-border bg-surface-muted text-ink-muted";
  }
}

export function AnalyticsContentTable({
  action,
  detailBase,
  filters,
  data,
  sourceOptions,
  fileName = "konten-analitik",
  showOrganization = true,
}: {
  action: string;
  detailBase: string;
  filters: AnalyticsContentFilters;
  data: AnalyticsContentPage;
  sourceOptions: AnalyticsSourceOption[];
  fileName?: string;
  showOrganization?: boolean;
}) {
  const exportParams = new URLSearchParams();
  if (filters.status !== "ALL") exportParams.set("status", filters.status);
  if (filters.sources.length > 0) {
    exportParams.set("source", filters.sources.join(","));
  }
  if (filters.period !== "ALL") exportParams.set("month", filters.period);
  const exportHref = `/api/v1/exports/submissions?${exportParams.toString()}`;
  const reportParams = new URLSearchParams();
  if (filters.period !== "ALL") reportParams.set("month", filters.period);
  if (filters.sources.length > 0) reportParams.set("source", filters.sources.join(","));
  const reportHref = `/api/v1/reports/achievement?${reportParams.toString()}`;

  return (
    <section
      aria-labelledby="analitik-tabel"
      className="rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <h2 id="analitik-tabel" className="text-base font-semibold text-foreground">
            Semua konten
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {formatNumberId(data.total)} konten ·{" "}
            {formatNumberId(data.approvedTotal)} disetujui · default menampilkan
            semua periode, sumber, dan status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="h-9">
            <a href={exportHref} download>
              <Download className="size-4" aria-hidden />
              CSV
            </a>
          </Button>
          <Button asChild size="sm" className="h-9">
            <a href={reportHref} download>
              <FileText className="size-4" aria-hidden />
              Laporan PDF
            </a>
          </Button>
        </div>
      </div>

      <form
        method="get"
        action={action}
        className="space-y-3 border-b border-border bg-surface-muted/30 px-4 py-3 sm:px-5"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
          <Filter className="size-4 text-brand-blue-600" aria-hidden />
          Filter dan sortir
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="relative lg:col-span-1">
            <span className="sr-only">Cari konten</span>
            <Search
              className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-ink-muted"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={filters.search}
              placeholder="Cari judul, kode, organisasi"
              className={`${inputClass} pl-8`}
            />
          </label>
          <label>
            <span className="sr-only">Periode</span>
            <select name="period" defaultValue={filters.period} className={inputClass}>
              <option value="ALL">{ANALYTICS_PERIOD_LABEL}</option>
              {monthOptions(filters.period === "ALL" ? monthKeyFor() : filters.period).map(
                (option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select name="status" defaultValue={filters.status} className={inputClass}>
              <option value="ALL">Semua status</option>
              {CONTENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Keputusan oleh</span>
            <select
              name="decidedBy"
              defaultValue={filters.decidedBy}
              className={inputClass}
            >
              <option value="ANY">Semua keputusan</option>
              <option value="BRANCH">Divalidasi cabang</option>
              <option value="MASTER">Keputusan master</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Sortir</span>
            <select name="sort" defaultValue={filters.sort} className={inputClass}>
              {Object.entries(ANALYTICS_SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="flex flex-wrap items-center gap-3">
          <legend className="sr-only">Sumber input</legend>
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
          <div className="ml-auto flex items-center gap-2">
            <Button type="submit" size="sm" variant="outline" className="h-8">
              <ArrowDownWideNarrow className="size-3.5" aria-hidden />
              Terapkan
            </Button>
            <Button asChild size="sm" variant="ghost" className="h-8">
              <Link href={action}>Atur ulang</Link>
            </Button>
          </div>
        </fieldset>
      </form>

      {data.rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-ink-muted sm:px-5">
          Tidak ada konten yang cocok dengan filter ini.
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[68rem] border-collapse text-sm">
            <caption className="sr-only">
              Seluruh konten pada cakupan analitik dengan status keputusan
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                <th scope="col" className="px-4 py-3 sm:px-5">Konten</th>
                <th scope="col" className="px-4 py-3 sm:px-5">Jenis</th>
                {showOrganization ? (
                  <th scope="col" className="px-4 py-3 sm:px-5">Organisasi</th>
                ) : null}
                <th scope="col" className="px-4 py-3 sm:px-5">Sumber</th>
                <th scope="col" className="px-4 py-3 sm:px-5">Tema</th>
                <th scope="col" className="px-4 py-3 sm:px-5">Status</th>
                <th scope="col" className="px-4 py-3 sm:px-5">Keputusan</th>
                <th scope="col" className="px-4 py-3 sm:px-5">Dibuat</th>
                <th scope="col" className="px-4 py-3 sm:px-5">
                  <span className="sr-only">Tindakan</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/70 align-top last:border-0"
                >
                  <td className="px-4 py-3 sm:px-5">
                    <Link
                      href={`${detailBase}/${row.id}`}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {row.title ?? "(tanpa judul)"}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {row.referenceCode}
                      {row.version > 1 ? ` · versi ${row.version}` : ""}
                      {row.resubmissionCount > 0
                        ? ` · ${row.resubmissionCount}× revisi`
                        : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <ContentTypeBadge contentType={row.contentType} />
                  </td>
                  {showOrganization ? (
                    <td className="px-4 py-3 text-ink-muted sm:px-5">
                      <p className="font-medium text-foreground">{row.organization}</p>
                      <p className="text-xs">{row.branchName ?? "Tanpa cabang"}</p>
                    </td>
                  ) : null}
                  <td className="px-4 py-3 sm:px-5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${sourceClass(row.source)}`}
                    >
                      {row.sourceLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted sm:px-5">
                    <p>
                      {row.subTheme
                        ? SUB_THEME_LABELS[row.subTheme as SubTheme] ?? row.subTheme
                        : "Tanpa sub-tema"}
                    </p>
                    <p className="text-xs">
                      {row.mainTheme === "EDUFAST" ? "EDUFAST" : "Non-EDUFAST"}
                      {row.platform
                        ? ` · ${PLATFORM_LABEL[row.platform] ?? row.platform}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted sm:px-5">
                    {row.decisionAt ? (
                      <>
                        <p>{formatDateTimeId(row.decisionAt)}</p>
                        <p className="text-xs">
                          {ROLE_LABEL[row.decidedBy ?? ""] ?? "Admin"}
                          {row.decisionSource === "MASTER_OVERRIDE"
                            ? " · override"
                            : ""}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs">Belum diputuskan</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted sm:px-5">
                    {formatDateId(row.dateCreated)}
                  </td>
                  <td className="px-4 py-3 text-right sm:px-5">
                    <Button asChild size="sm" variant="outline" className="h-8">
                      <Link href={`${detailBase}/${row.id}`}>Buka</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
        <p className="text-xs text-ink-muted">
          Halaman {data.page} dari {data.pageCount} ·{" "}
          {formatNumberId(ANALYTICS_TABLE_PAGE_SIZE)} baris per halaman
        </p>
        <div className="flex gap-2">
          <Button
            asChild={data.page > 1}
            size="sm"
            variant="outline"
            className="h-8"
            disabled={data.page <= 1}
          >
            {data.page > 1 ? (
              <Link href={buildHref(action, filters, { page: data.page - 1 })}>
                <ChevronLeft className="size-4" aria-hidden />
                Sebelumnya
              </Link>
            ) : (
              <span>
                <ChevronLeft className="size-4" aria-hidden />
                Sebelumnya
              </span>
            )}
          </Button>
          <Button
            asChild={data.page < data.pageCount}
            size="sm"
            variant="outline"
            className="h-8"
            disabled={data.page >= data.pageCount}
          >
            {data.page < data.pageCount ? (
              <Link href={buildHref(action, filters, { page: data.page + 1 })}>
                Berikutnya
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span>
                Berikutnya
                <ChevronRight className="size-4" aria-hidden />
              </span>
            )}
          </Button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        Menampilkan {formatNumberId(data.rows.length)} dari{" "}
        {formatNumberId(data.total)} konten. File ekspor {fileName}.
      </p>
    </section>
  );
}
