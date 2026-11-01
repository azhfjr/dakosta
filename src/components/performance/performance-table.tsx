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
  Search,
  SlidersHorizontal,
  Target,
  TrendingUp,
} from "lucide-react";

import { PrintButton } from "@/components/performance/print-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
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

const selectClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none";

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none";

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

      <section
        aria-label="Filter kinerja"
        className="rounded-xl border border-border bg-surface p-4 shadow-sm print:hidden"
      >
        <form method="get" action={basePath} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-medium text-ink-muted">
              Periode
              <select
                name="period"
                defaultValue={filters.period.key}
                className={`${selectClass} mt-1`}
              >
                {!knownPeriod ? (
                  <option value={filters.period.key}>
                    {filters.period.label}
                  </option>
                ) : null}
                <optgroup label="Bulan">
                  {options.months.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Triwulan">
                  {options.quarters.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Tahun">
                  {options.years.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            {showBranchFilter ? (
              <label className="block text-xs font-medium text-ink-muted">
                Cabang
                <select
                  name="branch"
                  defaultValue={filters.branchId ?? ""}
                  className={`${selectClass} mt-1`}
                >
                  <option value="">Semua cabang</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.regionName} · {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block text-xs font-medium text-ink-muted">
              Jenis instansi
              <select
                name="type"
                defaultValue={filters.source ?? ""}
                className={`${selectClass} mt-1`}
              >
                <option value="">Semua jenis</option>
                <option value="FASKES_FKRTL">Faskes FKRTL</option>
                <option value="FASKES_FKTP">Faskes FKTP</option>
                <option value="PEMDA">Pemda</option>
                <option value="OTHER">Stakeholder/Mitra</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-ink-muted">
              Nama / kode instansi
              <div className="relative mt-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden
                />
                <input
                  type="search"
                  name="q"
                  defaultValue={filters.q ?? ""}
                  maxLength={80}
                  placeholder="Cari nama atau kode"
                  className={`${inputClass} pl-9`}
                />
              </div>
            </label>
          </div>

          <details className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2">
            <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-muted select-none">
              <SlidersHorizontal className="size-3.5" aria-hidden />
              Filter lanjutan
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs font-medium text-ink-muted">
                Status target
                <select
                  name="status"
                  defaultValue={filters.status}
                  className={`${selectClass} mt-1`}
                >
                  <option value="ALL">Semua status</option>
                  <option value="MET">Tercapai</option>
                  <option value="BELOW">Di bawah target</option>
                  <option value="NO_TARGET">Target belum ditetapkan</option>
                </select>
              </label>
              <fieldset className="text-xs font-medium text-ink-muted">
                <legend>Rentang capaian (%)</legend>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    name="pmin"
                    min={0}
                    step={0.1}
                    defaultValue={filters.percentMin ?? ""}
                    aria-label="Capaian minimum (%)"
                    placeholder="Min"
                    className={inputClass}
                  />
                  <span aria-hidden>–</span>
                  <input
                    type="number"
                    name="pmax"
                    min={0}
                    step={0.1}
                    defaultValue={filters.percentMax ?? ""}
                    aria-label="Capaian maksimum (%)"
                    placeholder="Maks"
                    className={inputClass}
                  />
                </div>
              </fieldset>
              <fieldset className="text-xs font-medium text-ink-muted">
                <legend>Rentang realisasi</legend>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    name="rmin"
                    min={0}
                    step={1}
                    defaultValue={filters.approvedMin ?? ""}
                    aria-label="Realisasi minimum"
                    placeholder="Min"
                    className={inputClass}
                  />
                  <span aria-hidden>–</span>
                  <input
                    type="number"
                    name="rmax"
                    min={0}
                    step={1}
                    defaultValue={filters.approvedMax ?? ""}
                    aria-label="Realisasi maksimum"
                    placeholder="Maks"
                    className={inputClass}
                  />
                </div>
              </fieldset>
              <fieldset className="text-xs font-medium text-ink-muted">
                <legend>Rentang target</legend>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    name="tmin"
                    min={0}
                    step={1}
                    defaultValue={filters.targetMin ?? ""}
                    aria-label="Target minimum"
                    placeholder="Min"
                    className={inputClass}
                  />
                  <span aria-hidden>–</span>
                  <input
                    type="number"
                    name="tmax"
                    min={0}
                    step={1}
                    defaultValue={filters.targetMax ?? ""}
                    aria-label="Target maksimum"
                    placeholder="Maks"
                    className={inputClass}
                  />
                </div>
              </fieldset>
            </div>
            <input type="hidden" name="sort" value={filters.sort} />
            <input type="hidden" name="dir" value={filters.direction} />
            <input type="hidden" name="pageSize" value={filters.pageSize} />
          </details>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" className="h-10">
              Terapkan filter
            </Button>
            <Button asChild variant="ghost" className="h-10">
              <Link href={basePath}>Reset</Link>
            </Button>
            <span className="text-xs text-ink-muted">
              {formatNumberId(table.totalRows)} institusi cocok
            </span>
          </div>
        </form>
      </section>

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
