import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, Target as TargetIcon, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { monthOptions } from "@/lib/kpi/sql";
import { getTargetOverview } from "@/lib/targets";
import { requireRole } from "@/lib/session";
import { isMonthKey, monthKeyFor } from "@/lib/kpi/formulas";

export const metadata: Metadata = {
  title: "Target periode",
};

export const dynamic = "force-dynamic";

function scopeLabel(row: {
  stakeholderName: string | null;
  themeName: string | null;
}): string {
  if (row.stakeholderName && row.themeName) {
    return `${row.stakeholderName} · ${row.themeName}`;
  }
  if (row.stakeholderName) return row.stakeholderName;
  if (row.themeName) return `Tema ${row.themeName}`;
  return "Workspace (global)";
}

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

  const overview = await getTargetOverview(month);

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
            overview.rows.some(
              (row) => !row.stakeholderId && !row.themeId,
            )
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

      <section
        aria-labelledby="target-daftar"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="border-b border-border px-5 py-3">
          <h2 id="target-daftar" className="text-base font-semibold text-foreground">
            Cakupan target
          </h2>
          <p className="text-xs text-ink-muted">
            Target global, per stakeholder, per tema, atau kombinasi keduanya.
            Nilai capaian dihitung ulang dari data konten.
          </p>
        </div>

        {overview.rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <TargetIcon className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">
              Belum ada target untuk periode ini
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Target periode ini dapat ditetapkan melalui data seed demo;
              pengelolaan target dari antarmuka belum tersedia.
            </p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <caption className="sr-only">
                Target per cakupan pada periode terpilih
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-5 py-3">Cakupan</th>
                  <th scope="col" className="px-5 py-3 text-right">Target</th>
                  <th scope="col" className="px-5 py-3 text-right">Disetujui</th>
                  <th scope="col" className="px-5 py-3">Capaian</th>
                  <th scope="col" className="px-5 py-3">Periode</th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.rows.map((row) => {
                  const progress =
                    row.achievement === null
                      ? 0
                      : Math.min(100, row.achievement);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/70 align-top last:border-0"
                    >
                      <td className="px-5 py-3 font-medium text-foreground">
                        {scopeLabel(row)}
                      </td>
                      <td className="px-5 py-3 text-right text-ink-muted tabular">
                        {formatNumberId(row.targetCount)}
                      </td>
                      <td className="px-5 py-3 text-right text-foreground tabular">
                        {formatNumberId(row.approved)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-24 overflow-hidden rounded-full bg-surface-muted"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progress)}
                            aria-label={`Capaian ${scopeLabel(row)}`}
                          >
                            <div
                              className="h-full rounded-full bg-brand-blue-600"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-foreground tabular">
                            {formatPercent(row.achievement)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-ink-muted">
                        {row.periodStart} — {row.periodEnd}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button asChild size="sm" variant="outline" className="h-9">
                          <Link
                            href={`/admin?month=${overview.month}${
                              row.stakeholderId
                                ? `&stakeholderId=${row.stakeholderId}`
                                : ""
                            }${row.themeId ? `&themeId=${row.themeId}` : ""}`}
                          >
                            Lihat capaian
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
