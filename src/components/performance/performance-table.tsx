import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
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
import { Button } from "@/components/ui/button";
import { ORG_SOURCES, ORG_SOURCE_LABELS } from "@/lib/analytics/org-source";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import {
  buildPerformanceQuery,
  performanceSourceLabel,
  type PerformanceFilters,
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

function SortHeader({
  label,
  sortKey,
  filters,
  basePath,
  numeric = false,
}: {
  label: string;
  sortKey: PerformanceSort;
  filters: PerformanceFilters;
  basePath: string;
  numeric?: boolean;
}) {
  const active = filters.sort === sortKey;
  const nextDirection = active && filters.direction === "desc" ? "asc" : "desc";
  const href = `${basePath}?${buildPerformanceQuery(filters, {
    sort: sortKey,
    dir: nextDirection,
    page: 1,
  })}`;
  const Icon = filters.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={
        active
          ? filters.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={`px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-ink-muted ${
        numeric ? "text-right" : "text-left"
      }`}
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-1 rounded-sm underline-offset-4 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none ${
          active ? "text-foreground" : ""
        } ${numeric ? "justify-end" : ""}`}
      >
        {label}
        {active ? <Icon className="size-3.5" aria-hidden /> : null}
      </Link>
    </th>
  );
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
      kind: "search",
      name: "q",
      label: "Nama / kode instansi",
      value: filters.q ?? "",
      placeholder: "Cari nama atau kode",
    },
  ];

  const advancedFields: FilterField[] = [
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
      kind: "number",
      name: "pmin",
      label: "Capaian minimum (%)",
      value: filters.percentMin === null ? "" : String(filters.percentMin),
      min: 0,
      step: 0.1,
      placeholder: "Min",
    },
    {
      kind: "number",
      name: "pmax",
      label: "Capaian maksimum (%)",
      value: filters.percentMax === null ? "" : String(filters.percentMax),
      min: 0,
      step: 0.1,
      placeholder: "Maks",
    },
    {
      kind: "number",
      name: "rmin",
      label: "Realisasi minimum",
      value: filters.approvedMin === null ? "" : String(filters.approvedMin),
      min: 0,
      step: 1,
      placeholder: "Min",
    },
    {
      kind: "number",
      name: "rmax",
      label: "Realisasi maksimum",
      value: filters.approvedMax === null ? "" : String(filters.approvedMax),
      min: 0,
      step: 1,
      placeholder: "Maks",
    },
    {
      kind: "number",
      name: "tmin",
      label: "Target minimum",
      value: filters.targetMin === null ? "" : String(filters.targetMin),
      min: 0,
      step: 1,
      placeholder: "Min",
    },
    {
      kind: "number",
      name: "tmax",
      label: "Target maksimum",
      value: filters.targetMax === null ? "" : String(filters.targetMax),
      min: 0,
      step: 1,
      placeholder: "Maks",
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
        advancedFields={advancedFields}
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
                <tr className="border-b border-border text-left">
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-ink-muted"
                  >
                    Kedeputian
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-ink-muted"
                  >
                    Cabang
                  </th>
                  <SortHeader
                    label="Instansi"
                    sortKey="name"
                    filters={filters}
                    basePath={basePath}
                  />
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-ink-muted"
                  >
                    Jenis
                  </th>
                  <SortHeader
                    label="Target"
                    sortKey="target"
                    filters={filters}
                    basePath={basePath}
                    numeric
                  />
                  <SortHeader
                    label="Realisasi"
                    sortKey="approved"
                    filters={filters}
                    basePath={basePath}
                    numeric
                  />
                  <SortHeader
                    label="Selisih"
                    sortKey="difference"
                    filters={filters}
                    basePath={basePath}
                    numeric
                  />
                  <SortHeader
                    label="Capaian"
                    sortKey="percent"
                    filters={filters}
                    basePath={basePath}
                    numeric
                  />
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-ink-muted"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-ink-muted"
                  >
                    Periode
                  </th>
                  <SortHeader
                    label="Diperbarui"
                    sortKey="updated"
                    filters={filters}
                    basePath={basePath}
                  />
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
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">
                          {row.regionName ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">
                          {row.branchName ?? "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-foreground">
                            {row.name}
                          </p>
                          {row.faskesCode ? (
                            <p className="text-xs text-ink-muted">
                              {row.faskesCode}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">
                          {row.sourceLabel}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular">
                          {row.target === null
                            ? "N/A"
                            : formatNumberId(row.target)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular">
                          {formatNumberId(row.approved)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right tabular ${
                            row.difference === null
                              ? "text-ink-muted"
                              : row.difference < 0
                                ? "text-status-rejected"
                                : "text-status-approved"
                          }`}
                        >
                          {formatDifference(row)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
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
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">
                          {filters.period.label}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">
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
