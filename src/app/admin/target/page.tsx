import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, Target as TargetIcon, TrendingUp } from "lucide-react";

import { TargetManager } from "@/components/admin/target-manager";
import { TargetSyncPanel } from "@/components/admin/target-sync-panel";
import { StatCard } from "@/components/dashboard/stat-card";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { getFilterOptions } from "@/lib/filters/options";
import {
  buildFilterHref,
  firstParam,
  parseFilterPage,
} from "@/lib/filters/query";
import { isMonthKey, monthKeyFor, monthRange } from "@/lib/kpi/formulas";
import { requireRole } from "@/lib/session";
import { getTargetOverview } from "@/lib/targets";
import { getTargetSyncPreview } from "@/lib/targets/sync";

export const metadata: Metadata = {
  title: "Target periode",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${formatNumberId(value)}%`;
}

export default async function AdminTargetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;
  const rawMonth = firstParam(params, "month");
  const month = isMonthKey(rawMonth) ? rawMonth : monthKeyFor();

  const [overview, syncPreview, options] = await Promise.all([
    getTargetOverview(month, {
      page: parseFilterPage(firstParam(params, "page")),
      pageSize: PAGE_SIZE,
    }),
    getTargetSyncPreview(month),
    getFilterOptions(admin),
  ]);

  const { page, pageCount, total } = overview.pagination;
  const start = (page - 1) * PAGE_SIZE;
  const rows = overview.rows;
  const pageHref = (target: number) =>
    buildFilterHref("/admin/target", { month }, { page: target });

  const periodOptions = options.periods.some((option) => option.value === month)
    ? options.periods
    : [{ value: month, label: monthRange(month).label }, ...options.periods];

  const filterFields: FilterField[] = [
    {
      kind: "select",
      name: "month",
      label: "Periode bulan",
      value: month,
      options: periodOptions,
      allLabel: "",
      includeEmpty: false,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Target periode"
        description="Target capaian yang ditetapkan per periode. Capaian hanya dihitung dari konten disetujui berdasarkan tanggal disetujui."
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
      />

      <FilterBar
        action="/admin/target"
        label="Filter target"
        idPrefix="target"
        resetHref="/admin/target"
        fields={filterFields}
        columns={2}
        summary={`${formatNumberId(total)} cakupan target pada ${overview.periodLabel}.`}
        actions={
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href={`/admin?month=${month}`}>Buka ringkasan periode</Link>
          </Button>
        }
      />

      <section
        aria-label="Ringkasan target"
        className="grid gap-4 sm:grid-cols-3"
      >
        <StatCard
          label="Target global"
          value={
            overview.totals.hasGlobal
              ? formatNumberId(overview.totals.target)
              : "Belum ditetapkan"
          }
          hint={overview.periodLabel}
          icon={TargetIcon}
          tone="blue"
        />
        <StatCard
          label="Konten disetujui"
          value={formatNumberId(overview.totals.approved)}
          hint="Sesuai periode dan tanggal disetujui"
          icon={TrendingUp}
          tone="green"
        />
        <StatCard
          label="Capaian target global"
          value={formatPercent(overview.totals.achievement)}
          hint={`${formatNumberId(overview.totals.scopes)} cakupan target tercatat`}
          icon={Gauge}
          tone="teal"
        />
      </section>

      <TargetSyncPanel month={month} sources={syncPreview.sources} />

      <TargetManager month={month} rows={rows} />

      {pageCount > 1 ? (
        <nav
          aria-label="Navigasi halaman target"
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-5 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-ink-muted">
            Menampilkan {start + 1}–{start + rows.length} dari{" "}
            {formatNumberId(total)} cakupan target · halaman {page} dari{" "}
            {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              asChild={page > 1}
              variant="outline"
              className="h-9"
              disabled={page <= 1}
            >
              {page > 1 ? (
                <Link href={pageHref(page - 1)}>Sebelumnya</Link>
              ) : (
                <span>Sebelumnya</span>
              )}
            </Button>
            <Button
              asChild={page < pageCount}
              variant="outline"
              className="h-9"
              disabled={page >= pageCount}
            >
              {page < pageCount ? (
                <Link href={pageHref(page + 1)}>Berikutnya</Link>
              ) : (
                <span>Berikutnya</span>
              )}
            </Button>
          </div>
        </nav>
      ) : null}
    </PageContainer>
  );
}
