import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Target,
  TrendingUp,
} from "lucide-react";

import { PrintButton } from "@/components/performance/print-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { SortHeader } from "@/components/table/sort-header";
import { Button } from "@/components/ui/button";
import { ORG_SOURCES, ORG_SOURCE_LABELS } from "@/lib/analytics/org-source";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import {
  buildPerformanceQuery,
  performanceSourceLabel,
  type PerformanceRow,
  type PerformanceSort,
  type PerformanceTable,
  type PerformanceTargetStatus,
} from "@/lib/performance";
import { periodOptions } from "@/lib/periods";

const STATUS_META: Record<
  PerformanceTargetStatus,
  { label: string; className: string; barClassName: string }
> = {
  MET: {
    label: "Tercapai",
    className: "bg-status-approved/10 text-status-approved",
    barClassName: "bg-status-approved",
  },
  BELOW: {
    label: "Di bawah target",
    className: "bg-status-rejected/10 text-status-rejected",
    barClassName: "bg-status-rejected",
  },
  NO_TARGET: {
    label: "Target belum ditetapkan",
    className: "bg-surface-muted text-ink-muted",
    barClassName: "bg-ink-muted/30",
  },
};

const plainHeaderClass =
  "px-3 py-2.5 text-left text-xs font-medium tracking-wide whitespace-nowrap text-ink-muted uppercase sm:px-4";

function formatPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatDifference(row: PerformanceRow): string {
  if (row.difference === null) return "N/A";
  const formatted = formatNumberId(Math.abs(row.difference));
  if (row.difference === 0) return "0";
  return `${row.difference > 0 ? "+" : "−"}${formatted}`;
}

export function PerformanceTable({
  table,
  basePath,
  scopeLabel,
  canExport,
  showBranchFilter,
}: {
  table: PerformanceTable;
  basePath: string;
  scopeLabel: string;
  canExport: boolean;
  showBranchFilter: boolean;
}) {
  const { filters, rows, summary, branches } = table;
  const options = periodOptions();
  const knownPeriod =
    options.months.some((option) => option.value === filters.period.key) ||
    options.quarters.some((option) => option.value === filters.period.key) ||
    options.years.some((option) => option.value === filters.period.key);
  const query = buildPerformanceQuery(filters);
  const csvHref = `/api/v1/exports/performance?${query}`;
  const pdfHref = `/api/v1/reports/performance?${query}`;
  const currentBranch = branches.find(
    (branch) => branch.id === filters.branchId,
  );
  const filterSummary = [
    filters.period.label,
    performanceSourceLabel(filters.source),
    ...(currentBranch
      ? [`${currentBranch.regionName} · ${currentBranch.name}`]
      : []),
    ...(filters.q ? [`Pencarian "${filters.q}"`] : []),
  ].join(" · ");

  const periodChoices = [
    ...options.months,
    ...options.quarters,
    ...options.years,
  ];
  const periodSelectOptions = knownPeriod
    ? periodChoices
    : [
        { value: filters.period.key, label: filters.period.label },
        ...periodChoices,
      ];

  const sortHref = (key: PerformanceSort): string => {
    const nextDirection =
      filters.sort === key
        ? filters.direction === "asc"
          ? "desc"
          : "asc"
        : key === "name"
          ? "asc"
          : "desc";
    return `${basePath}?${buildPerformanceQuery(filters, {
      sort: key,
      dir: nextDirection,
      page: 1,
    })}`;
  };
  const sortProps = (key: PerformanceSort) => ({
    href: sortHref(key),
    active: filters.sort === key,
    direction: filters.direction,
  });

  const filterFields: FilterField[] = [
    {
      kind: "select",
      name: "period",
      label: "Periode",
      value: filters.period.key,
      options: periodSelectOptions,
      allLabel: "",
      includeEmpty: false,
    },
    ...(showBranchFilter
      ? [
          {
            kind: "select" as const,
            name: "branch",
            label: "Cabang",
            value: filters.branchId ?? "",
            options: branches.map((branch) => ({
              value: branch.id,
              label: `${branch.regionName} · ${branch.name}`,
            })),
            allLabel: "Semua cabang",
          },
        ]
      : []),
    {
      kind: "select",
      name: "type",
      label: "Jenis instansi",
      value: filters.source ?? "",
      options: ORG_SOURCES.map((source) => ({
        value: source,
        label: ORG_SOURCE_LABELS[source],
      })),
      allLabel: "Semua jenis",
    },
    {
      kind: "select",
      name: "status",
      label: "Status target",
      value: filters.status === "ALL" ? "" : filters.status,
      options: [
        { value: "MET", label: "Tercapai" },
        { value: "BELOW", label: "Di bawah target" },
        { value: "NO_TARGET", label: "Target belum ditetapkan" },
      ],
      allLabel: "Semua status",
    },
    {
      kind: "search",
      name: "q",
      label: "Nama / kode instansi",
      value: filters.q ?? "",
      placeholder: "Cari nama atau kode",
    },
  ];

  return (
    <div className="space-y-6">
      <section
        aria-label="Ringkasan kinerja"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <StatCard
          label="Institusi dalam scope"
          value={formatNumberId(summary.institutions)}
          hint={scopeLabel}
          icon={Building2}
          tone="blue"
        />
        <StatCard
          label="Target terisi"
          value={`${formatNumberId(summary.withTarget)} / ${formatNumberId(summary.institutions)}`}
          hint="Target belum ditetapkan ditampilkan N/A"
          icon={Target}
          tone="teal"
        />
        <StatCard
          label="Realisasi approved"
          value={formatNumberId(summary.approved)}
          hint="COUNT(DISTINCT konten) approval final"
          icon={CheckCircle2}
          tone="green"
        />
        <StatCard
          label="Capaian agregat"
          value={formatPercent(summary.achievement)}
          hint="Dari institusi yang memiliki target"
          icon={TrendingUp}
          tone="amber"
        />
        <StatCard
          label="Target tercapai"
          value={`${formatNumberId(summary.met)} / ${formatNumberId(summary.withTarget)}`}
          hint="Institusi dengan realisasi ≥ target"
          icon={CheckCircle2}
          tone={
            summary.met === summary.withTarget && summary.withTarget > 0
              ? "green"
              : "neutral"
          }
        />
      </section>

      <FilterBar
        action={basePath}
        label="Filter kinerja"
        idPrefix="kinerja"
        resetHref={basePath}
        fields={filterFields}
        hidden={{
          sort: filters.sort,
          dir: filters.direction,
          pageSize: String(filters.pageSize),
        }}
        summary={`${formatNumberId(table.totalRows)} institusi cocok. Realisasi hanya menghitung konten approved berdasarkan tanggal approval final.`}
        className="print:hidden"
      />

      <section aria-label="Tabel kinerja" className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Tabel pencapaian per instansi
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
              Realisasi hanya menghitung konten berstatus approved berdasarkan
              tanggal approval final dalam periode terpilih. Target per instansi
              adalah penjumlahan target bulanan; target yang belum ditetapkan
              ditampilkan N/A, bukan 0.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrintButton />
            {canExport ? (
              <>
                <Button asChild variant="outline" className="h-9">
                  <a href={csvHref}>
                    <Download className="mr-2 size-4" aria-hidden />
                    Unduh CSV
                  </a>
                </Button>
                <Button asChild variant="outline" className="h-9">
                  <a href={pdfHref}>
                    <FileText className="mr-2 size-4" aria-hidden />
                    Unduh PDF
                  </a>
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="hidden print:block">
          <h2 className="text-lg font-semibold text-black">
            Laporan Kinerja per Instansi
          </h2>
          <p className="mt-1 text-xs text-black">
            {filterSummary} · {scopeLabel} · Dicetak{" "}
            {formatDateTimeId(table.generatedAt)} WIB
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
            <table className="w-full min-w-[980px] border-collapse text-sm print:min-w-0 print:text-[10px]">
              <caption className="sr-only">
                Kinerja per instansi untuk {filterSummary}. Angka realisasi
                hanya konten approved berdasarkan tanggal approval final.
              </caption>
              <thead className="sticky top-0 z-10 bg-surface-muted print:static print:bg-transparent">
                <tr className="border-b border-border">
                  <th scope="col" className={plainHeaderClass}>
                    Kedeputian
                  </th>
                  <th scope="col" className={plainHeaderClass}>
                    Cabang
                  </th>
                  <SortHeader label="Instansi" {...sortProps("name")} />
                  <th scope="col" className={plainHeaderClass}>
                    Jenis
                  </th>
                  <SortHeader
                    label="Target"
                    {...sortProps("target")}
                    align="right"
                  />
                  <SortHeader
                    label="Realisasi"
                    {...sortProps("approved")}
                    align="right"
                  />
                  <SortHeader
                    label="Selisih"
                    {...sortProps("difference")}
                    align="right"
                  />
                  <SortHeader
                    label="Capaian"
                    {...sortProps("percent")}
                    align="right"
                  />
                  <th scope="col" className={plainHeaderClass}>
                    Status
                  </th>
                  <th scope="col" className={plainHeaderClass}>
                    Periode
                  </th>
                  <SortHeader label="Diperbarui" {...sortProps("updated")} />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-12 text-center text-sm text-ink-muted"
                    >
                      <p className="font-medium text-foreground">
                        Tidak ada institusi yang cocok dengan filter.
                      </p>
                      <p className="mt-1">
                        Longgarkan filter atau{" "}
                        <Link
                          href={basePath}
                          className="font-semibold text-brand-blue-800 underline-offset-4 hover:underline"
                        >
                          reset filter
                        </Link>
                        .
                      </p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const status = STATUS_META[row.status];
                    const barWidth =
                      row.achievement === null
                        ? 0
                        : Math.min(100, Math.max(0, row.achievement));
                    return (
                      <tr
                        key={row.stakeholderId}
                        className="border-b border-border/70 align-top last:border-0 hover:bg-surface-muted/40 print:break-inside-avoid"
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted sm:px-4">
                          {row.regionName ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted sm:px-4">
                          {row.branchName ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 sm:px-4">
                          <p className="font-medium text-foreground">
                            {row.name}
                          </p>
                          {row.faskesCode ? (
                            <p className="text-xs text-ink-muted">
                              {row.faskesCode}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted sm:px-4">
                          {row.sourceLabel}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular sm:px-4">
                          {row.target === null
                            ? "N/A"
                            : formatNumberId(row.target)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular sm:px-4">
                          {formatNumberId(row.approved)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right tabular sm:px-4 ${
                            row.difference === null
                              ? "text-ink-muted"
                              : row.difference < 0
                                ? "text-status-rejected"
                                : "text-status-approved"
                          }`}
                        >
                          {formatDifference(row)}
                        </td>
                        <td className="px-3 py-2.5 text-right sm:px-4">
                          <p className="font-medium tabular">
                            {formatPercent(row.achievement)}
                          </p>
                          <div
                            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted print:hidden"
                            role="presentation"
                          >
                            <div
                              className={`h-full rounded-full ${status.barClassName}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 sm:px-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted sm:px-4">
                          {filters.period.label}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted sm:px-4">
                          {formatDateTimeId(row.updatedAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <nav
          aria-label="Navigasi halaman kinerja"
          className="flex flex-wrap items-center justify-between gap-2 print:hidden"
        >
          <p className="text-xs text-ink-muted">
            Menampilkan{" "}
            {rows.length === 0 ? 0 : (table.page - 1) * filters.pageSize + 1}–
            {(table.page - 1) * filters.pageSize + rows.length} dari{" "}
            {formatNumberId(table.totalRows)} institusi · Halaman {table.page}{" "}
            dari {table.pageCount}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="h-9">
              <Link
                href={`${basePath}?${buildPerformanceQuery(filters, {
                  page: Math.max(1, table.page - 1),
                })}`}
                aria-disabled={table.page <= 1}
                className={
                  table.page <= 1 ? "pointer-events-none opacity-50" : ""
                }
              >
                <ChevronLeft className="size-4" aria-hidden />
                Sebelumnya
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-9">
              <Link
                href={`${basePath}?${buildPerformanceQuery(filters, {
                  page: Math.min(table.pageCount, table.page + 1),
                })}`}
                aria-disabled={table.page >= table.pageCount}
                className={
                  table.page >= table.pageCount
                    ? "pointer-events-none opacity-50"
                    : ""
                }
              >
                Berikutnya
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </nav>
      </section>
    </div>
  );
}
