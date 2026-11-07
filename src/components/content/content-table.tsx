import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";

import { ContentDetailDrawer } from "@/components/content/content-detail-drawer";
import { ContentTypeBadge } from "@/components/content/content-type-badge";
import { StatusBadge } from "@/components/content/status-badge";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { Button } from "@/components/ui/button";
import type { AnalyticsContentPage } from "@/lib/analytics/content-table";
import { PLATFORM_LABEL, STATUS_LABEL } from "@/lib/content-status";
import { formatDateId, formatDateTimeId, formatNumberId } from "@/lib/dates";
import {
  KONTEN_SORTS,
  KONTEN_SORT_LABELS,
  defaultKontenSort,
  kontenQuery,
  type KontenFilters,
} from "@/lib/filters/konten";
import type { FilterOptions } from "@/lib/filters/options";
import { buildFilterHref, filterResetHref } from "@/lib/filters/query";
import {
  MAIN_THEME_LABELS,
  SUB_THEME_LABELS,
  type MainTheme,
  type SubTheme,
} from "@/lib/taxonomy";

/**
 * Shared Detail Konten table. `filters.mode` decides whether every status is
 * visible (`all`) or the canonical approved subset (`approved`); the server
 * always enforces scope and the approved predicate.
 */
export function ContentTable({
  action,
  detailBase,
  filters,
  data,
  options,
  exportHref,
  pdfHref,
  showStakeholderFilter = true,
  emptyNote,
}: {
  action: string;
  detailBase: string;
  filters: KontenFilters;
  data: AnalyticsContentPage;
  options: FilterOptions;
  exportHref: string;
  pdfHref?: string;
  showStakeholderFilter?: boolean;
  emptyNote?: string;
}) {
  const query = kontenQuery(filters);
  const resetHref = filterResetHref(action);
  const mode = filters.mode;

  const statusOptions = options.statuses.map((option) =>
    option.value === "APPROVED"
      ? { ...option, label: "Hanya disetujui" }
      : option,
  );

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
      name: "status",
      label: "Status",
      value: filters.status === "ALL" ? "" : filters.status,
      options: statusOptions,
      allLabel: "Semua status",
    },
    {
      kind: "select",
      name: "orgType",
      label: "Jenis organisasi",
      value: filters.orgType ?? "",
      options: options.orgTypes,
      allLabel: "Semua jenis",
    },
    {
      kind: "select",
      name: "mainTheme",
      label: "Tema utama",
      value: filters.mainTheme ?? "",
      options: options.mainThemes,
      allLabel: "Semua tema",
    },
    {
      kind: "select",
      name: "subTheme",
      label: "Sub-tema",
      value: filters.subTheme ?? "",
      options: options.subThemes,
      allLabel: "Semua sub-tema",
    },
    ...(showStakeholderFilter
      ? ([
          {
            kind: "select",
            name: "stakeholderId",
            label: "Instansi",
            value: filters.stakeholderId ?? "",
            options: options.stakeholders,
            allLabel: "Semua instansi",
          },
        ] satisfies FilterField[])
      : []),
  ];

  const advancedFields: FilterField[] = [
    {
      kind: "select",
      name: "type",
      label: "Jenis konten",
      value: filters.contentType ?? "",
      options: options.contentTypes,
      allLabel: "Semua jenis konten",
    },
    {
      kind: "select",
      name: "platform",
      label: "Platform",
      value: filters.platform ?? "",
      options: options.platforms,
      allLabel: "Semua platform",
    },
    {
      kind: "date",
      name: "from",
      label: mode === "approved" ? "Disetujui dari" : "Konten dari",
      value: filters.dateFrom ?? "",
    },
    {
      kind: "date",
      name: "to",
      label: mode === "approved" ? "Disetujui sampai" : "Konten sampai",
      value: filters.dateTo ?? "",
    },
    {
      kind: "select",
      name: "period",
      label: "Bulan",
      value: filters.period === "ALL" ? "" : filters.period,
      options: options.periods,
      allLabel: "Semua bulan",
    },
    {
      kind: "select",
      name: "sort",
      label: "Urutkan",
      value: filters.sort === defaultKontenSort(mode) ? "" : filters.sort,
      options: KONTEN_SORTS.filter(
        (sort) => sort !== defaultKontenSort(mode),
      ).map((sort) => ({ value: sort, label: KONTEN_SORT_LABELS[sort] })),
      allLabel: KONTEN_SORT_LABELS[defaultKontenSort(mode)],
    },
  ];

  const hidden: Record<string, string> = {};
  if (filters.stakeholderId) hidden.stakeholderId = filters.stakeholderId;
  if (mode === "all") hidden.mode = "all";

  const exportActions = (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm" className="h-9">
        <a href={exportHref}>Ekspor CSV</a>
      </Button>
      {pdfHref ? (
        <Button asChild variant="outline" size="sm" className="h-9">
          <a href={pdfHref}>Unduh PDF</a>
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <FilterBar
        action={action}
        fields={fields}
        advancedFields={advancedFields}
        hidden={Object.keys(hidden).length > 0 ? hidden : undefined}
        resetHref={resetHref}
        label="Filter detail konten"
        idPrefix="konten"
        summary={`${formatNumberId(data.total)} konten sesuai filter. Ekspor mengikuti seluruh hasil filter, bukan hanya halaman ini.`}
        actions={exportActions}
      />

      <section
        aria-labelledby="konten-tabel"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="konten-tabel"
            className="text-base font-semibold text-foreground"
          >
            {mode === "approved" ? "Konten disetujui" : "Detail konten"}
          </h2>
          <p className="text-xs text-ink-muted">
            {formatNumberId(data.total)} konten ·{" "}
            {formatNumberId(data.approvedTotal)} disetujui · halaman {data.page}{" "}
            dari {data.pageCount}
          </p>
        </div>

        {data.rows.length === 0 ? (
          <div className="px-4 py-14 text-center sm:px-5">
            <FileText className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">
              Tidak ada konten pada filter ini
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {emptyNote ??
                "Ubah filter atau atur ulang untuk melihat konten lainnya."}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 h-9">
              <Link href={resetHref}>Atur ulang filter</Link>
            </Button>
          </div>
        ) : (
          <div
            className="relative overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Tabel detail konten, dapat digulir"
          >
            <table className="w-full min-w-[76rem] border-collapse text-sm">
              <caption className="sr-only">
                Detail konten pada cakupan Anda beserta status dan keputusannya
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Kode
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Judul
                  </th>
                  {showStakeholderFilter ? (
                    <th scope="col" className="px-4 py-3 sm:px-5">
                      Organisasi
                    </th>
                  ) : null}
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
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Dibuat
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Disetujui
                  </th>
                  <th scope="col" className="px-4 py-3 sm:px-5">
                    Keputusan
                  </th>
                  <th scope="col" className="px-4 py-3 text-right sm:px-5">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const detailHref = `${detailBase}/${row.id}`;
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/70 align-top last:border-0 hover:bg-surface-muted/60"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-ink-muted sm:px-5">
                        {row.referenceCode}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <Link
                          href={detailHref}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {row.title ?? "(tanpa judul)"}
                        </Link>
                        {row.version > 1 || row.resubmissionCount > 0 ? (
                          <p className="text-xs text-ink-muted">
                            versi {row.version}
                            {row.resubmissionCount > 0
                              ? ` · ${row.resubmissionCount}× revisi`
                              : ""}
                          </p>
                        ) : null}
                      </td>
                      {showStakeholderFilter ? (
                        <td className="px-4 py-3 text-ink-muted sm:px-5">
                          <span className="block text-foreground">
                            {row.organization}
                          </span>
                          <span className="text-xs">
                            {row.branchName ?? "Tanpa cabang"}
                          </span>
                        </td>
                      ) : null}
                      <td className="px-4 py-3 text-ink-muted sm:px-5">
                        <span className="block text-foreground">
                          {row.subTheme
                            ? (SUB_THEME_LABELS[row.subTheme as SubTheme] ??
                              row.subTheme)
                            : "Tanpa sub-tema"}
                        </span>
                        <span className="text-xs">
                          {row.mainTheme
                            ? (MAIN_THEME_LABELS[row.mainTheme as MainTheme] ??
                              row.mainTheme)
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <ContentTypeBadge contentType={row.contentType} />
                      </td>
                      <td className="px-4 py-3 text-ink-muted sm:px-5">
                        {row.platform
                          ? (PLATFORM_LABEL[row.platform] ?? row.platform)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-ink-muted sm:px-5">
                        {formatDateId(row.dateCreated)}
                      </td>
                      <td className="px-4 py-3 text-ink-muted sm:px-5">
                        {row.approvedAt ? formatDateId(row.approvedAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-muted sm:px-5">
                        <span className="block text-foreground">
                          {row.decidedBy
                            ? (STATUS_LABEL[
                                row.status as keyof typeof STATUS_LABEL
                              ] ?? row.status)
                            : "Belum diputuskan"}
                        </span>
                        <span className="text-xs">
                          {row.decisionAt
                            ? formatDateTimeId(row.decisionAt)
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ContentDetailDrawer
                            id={row.id}
                            label={row.title ?? row.referenceCode}
                            detailHref={detailHref}
                          />
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-8"
                          >
                            <Link href={detailHref}>Buka</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
          <p className="text-xs text-ink-muted">
            Menampilkan{" "}
            {data.rows.length === 0
              ? "0"
              : `${formatNumberId((data.page - 1) * 25 + 1)}–${formatNumberId(
                  (data.page - 1) * 25 + data.rows.length,
                )}`}{" "}
            dari {formatNumberId(data.total)}
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
