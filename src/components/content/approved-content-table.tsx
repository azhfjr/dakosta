import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, ShieldCheck } from "lucide-react";

import { ContentTypeBadge } from "@/components/content/content-type-badge";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { Button } from "@/components/ui/button";
import type { AnalyticsContentPage } from "@/lib/analytics/content-table";
import { ORG_SOURCE_LABELS, type OrgSource } from "@/lib/analytics/org-source";
import { formatDateId, formatNumberId } from "@/lib/dates";
import { buildFilterHref, filterResetHref } from "@/lib/filters/query";
import {
  KONTEN_SORTS,
  KONTEN_SORT_LABELS,
  kontenQuery,
  type KontenFilters,
  type KontenSort,
} from "@/lib/filters/konten";
import type { FilterOptions } from "@/lib/filters/options";
import { PLATFORM_LABEL } from "@/lib/content-status";
import { SUB_THEME_LABELS, type SubTheme } from "@/lib/taxonomy";

function sourceClass(source: OrgSource): string {
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

/**
 * Read-only approved content table for Admin Wilayah and Admin Cabang. Status
 * is forced server-side; this component never renders a status filter.
 */
export function ApprovedContentTable({
  action,
  detailBase,
  filters,
  data,
  options,
}: {
  action: string;
  detailBase: string;
  filters: KontenFilters;
  data: AnalyticsContentPage;
  options: FilterOptions;
}) {
  const query = kontenQuery(filters);
  const resetHref = filterResetHref(action);

  const fields: FilterField[] = [
    {
      kind: "search",
      name: "q",
      label: "Cari konten",
      value: filters.search,
      placeholder: "Judul, kode, atau organisasi",
    },
    {
      kind: "select",
      name: "period",
      label: "Bulan disetujui",
      value: filters.period === "ALL" ? "" : filters.period,
      options: options.periods,
      allLabel: "Semua bulan disetujui",
    },
    {
      kind: "select",
      name: "source",
      label: "Sumber",
      value: filters.source ?? "",
      options: options.sources,
      allLabel: "Semua sumber",
    },
    {
      kind: "select",
      name: "subTheme",
      label: "Sub-tema",
      value: filters.subTheme ?? "",
      options: options.subThemes,
      allLabel: "Semua sub-tema",
    },
    {
      kind: "select",
      name: "type",
      label: "Jenis konten",
      value: filters.contentType ?? "",
      options: options.contentTypes,
      allLabel: "Semua jenis",
    },
    {
      kind: "select",
      name: "sort",
      label: "Urutkan",
      value: filters.sort === "approved_recent" ? "" : filters.sort,
      options: KONTEN_SORTS.filter(
        (sort): sort is Exclude<KontenSort, "approved_recent"> =>
          sort !== "approved_recent",
      ).map((sort) => ({ value: sort, label: KONTEN_SORT_LABELS[sort] })),
      allLabel: KONTEN_SORT_LABELS.approved_recent,
    },
  ];

  const hidden: Record<string, string> | undefined = filters.stakeholderId
    ? { stakeholderId: filters.stakeholderId }
    : undefined;

  return (
    <div className="space-y-6">
      <FilterBar
        action={action}
        fields={fields}
        hidden={hidden}
        resetHref={resetHref}
        label="Filter konten disetujui"
        idPrefix="konten"
      />

      <section
        aria-labelledby="konten-disetujui-tabel"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2
              id="konten-disetujui-tabel"
              className="text-base font-semibold text-foreground"
            >
              Daftar konten disetujui
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {formatNumberId(data.total)} konten tervalidasi pada cakupan ini ·
              hanya status Disetujui yang ditampilkan.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-approved/10 px-2.5 py-1 text-xs font-medium text-status-approved">
            <ShieldCheck className="size-3.5" aria-hidden />
            Tervalidasi
          </span>
        </div>

        {data.rows.length === 0 ? (
          <div className="px-4 py-12 text-center sm:px-5">
            <FileText className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">
              Tidak ada konten disetujui yang cocok
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Ubah filter atau atur ulang untuk melihat seluruh konten
              tervalidasi.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 h-9">
              <Link href={resetHref}>Atur ulang filter</Link>
            </Button>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[72rem] border-collapse text-sm">
              <caption className="sr-only">
                Konten yang telah disetujui pada cakupan Anda
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Kode
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Judul
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Organisasi
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Cabang
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Tema / sub-tema
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Jenis
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Platform
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Disetujui
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Sumber
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/70 align-top last:border-0 hover:bg-surface-muted/60"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted sm:px-5">
                      {row.referenceCode}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <Link
                        href={`${detailBase}/${row.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {row.title ?? "(tanpa judul)"}
                      </Link>
                      {row.version > 1 ? (
                        <p className="text-xs text-ink-muted">
                          versi {row.version}
                          {row.resubmissionCount > 0
                            ? ` · ${row.resubmissionCount}× revisi`
                            : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink-muted sm:px-5">
                      {row.organization}
                    </td>
                    <td className="px-4 py-3 text-ink-muted sm:px-5">
                      {row.branchName ?? "Tanpa cabang"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted sm:px-5">
                      <p>
                        {row.subTheme
                          ? (SUB_THEME_LABELS[row.subTheme as SubTheme] ??
                            row.subTheme)
                          : "Tanpa sub-tema"}
                      </p>
                      <p className="text-xs">
                        {row.mainTheme === "EDUFAST"
                          ? "EDUFAST"
                          : "Non-EDUFAST"}
                      </p>
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <ContentTypeBadge contentType={row.contentType} />
                    </td>
                    <td className="px-4 py-3 text-ink-muted sm:px-5">
                      {row.platform
                        ? (PLATFORM_LABEL[row.platform] ?? row.platform)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted sm:px-5">
                      {row.approvedAt ? formatDateId(row.approvedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${sourceClass(row.source)}`}
                      >
                        {ORG_SOURCE_LABELS[row.source]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right sm:px-5">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8"
                      >
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
            {formatNumberId(data.rows.length)} dari {formatNumberId(data.total)}{" "}
            konten.
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
                <Link
                  href={buildFilterHref(
                    action,
                    query,
                    { page: data.page - 1 },
                    { keepPage: true },
                  )}
                >
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
                <Link
                  href={buildFilterHref(
                    action,
                    query,
                    { page: data.page + 1 },
                    { keepPage: true },
                  )}
                >
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
      </section>
    </div>
  );
}
