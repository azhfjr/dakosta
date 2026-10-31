import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, Target as TargetIcon, TrendingUp } from "lucide-react";

import { TargetManager } from "@/components/admin/target-manager";
import { TargetSyncPanel } from "@/components/admin/target-sync-panel";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { isMonthKey, monthKeyFor } from "@/lib/kpi/formulas";
import { monthOptions } from "@/lib/kpi/sql";
import { requireRole } from "@/lib/session";
import { getTargetOverview, listTargetStakeholders } from "@/lib/targets";
import { getTargetSyncPreview } from "@/lib/targets/sync";

export const metadata: Metadata = {
  title: "Target periode",
};

export const dynamic = "force-dynamic";

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${formatNumberId(value)}%`;
}

export default async function AdminTargetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const rawMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const month = isMonthKey(rawMonth) ? rawMonth : monthKeyFor();

  const [overview, stakeholders, syncPreview] = await Promise.all([
    getTargetOverview(month),
    listTargetStakeholders(),
    getTargetSyncPreview(month),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Target periode
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Target capaian yang ditetapkan per periode. Capaian hanya dihitung
            dari konten disetujui berdasarkan tanggal disetujui.
          </p>
        </div>
        <p className="text-xs text-ink-muted">
          Diperbarui {formatDateTimeId(new Date())} WIB
        </p>
      </header>

      <section
        aria-label="Filter target"
        className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
      >
        <form method="get" action="/admin/target" className="flex flex-wrap items-end gap-2">
          <label className="flex-1 sm:max-w-xs">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">
              Periode bulan
            </span>
            <select
              name="month"
              defaultValue={month}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {monthOptions(month).map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" className="h-10">
            Tampilkan
          </Button>
          <Button asChild variant="ghost" className="h-10">
            <Link href={`/admin?month=${month}`}>Buka ringkasan periode</Link>
          </Button>
        </form>
      </section>

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

      <TargetManager month={month} rows={overview.rows} stakeholders={stakeholders} />
    </div>
  );
}
