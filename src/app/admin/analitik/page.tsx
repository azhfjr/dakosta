import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  ClipboardList,
  Clock3,
  Gauge,
  Percent,
} from "lucide-react";

import { StatusBadge } from "@/components/content/status-badge";
import { DistributionCard } from "@/components/analytics/distribution-card";
import { RankingsTable } from "@/components/analytics/rankings-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { LazyMonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart-lazy";
import { Button } from "@/components/ui/button";
import {
  getContentTypeDistribution,
  getEdufastCompliance,
  getMainThemeDistribution,
  getSubThemeDistribution,
} from "@/lib/analytics/distribution";
import { getRedNotice } from "@/lib/analytics/red-notice";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { listFaskesRankings } from "@/lib/hierarchy";
import {
  getDashboardOverview,
  getKpiFilterOptions,
  getMonthlyTrend,
  getTopStakeholderTotals,
  monthOptions,
  parseKpiFiltersFromParams,
} from "@/lib/kpi/sql";
import { targetSourceLabel } from "@/lib/kpi/formulas";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Analitik",
};

export const dynamic = "force-dynamic";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${formatNumberId(value)}%`;
}

function formatDays(value: number | null): string {
  return value === null ? "N/A" : `${formatNumberId(value)} hari`;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;
  const filters = parseKpiFiltersFromParams(params);

  const [overview, options, monthly, topStakeholders, contentType, mainTheme, subTheme, compliance, rankings, redNotice] =
    await Promise.all([
      getDashboardOverview(admin, filters),
      getKpiFilterOptions(admin),
      getMonthlyTrend(admin, filters, 6),
      getTopStakeholderTotals(admin, filters, 10),
      getContentTypeDistribution(admin),
      getMainThemeDistribution(admin),
      getSubThemeDistribution(admin),
      getEdufastCompliance(admin),
      listFaskesRankings(admin.scope, 10),
      getRedNotice(admin),
    ]);

  const { approved } = overview;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Analitik
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Analisis capaian, kualitas keputusan, dan tren enam bulan. Semua
            angka hanya menghitung konten disetujui sesuai dasar tanggal yang
            dipilih.
          </p>
        </div>
        <p className="text-xs text-ink-muted">
          Diperbarui {formatDateTimeId(overview.generatedAt)} WIB
        </p>
      </header>

      <section
        aria-label="Filter analitik"
        className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
      >
        <form method="get" action="/admin/analitik" className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Gauge className="size-4 text-brand-blue-600" aria-hidden />
            Filter analitik
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label htmlFor="analitik-month" className="text-xs font-medium text-ink-muted">
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
                {options.stakeholders.map((stakeholder) => (
                  <option key={stakeholder.id} value={stakeholder.id}>
                    {stakeholder.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="analitik-theme"
                className="text-xs font-medium text-ink-muted"
              >
                Tema
              </label>
              <select
                id="analitik-theme"
                name="themeId"
                defaultValue={filters.themeId ?? ""}
                className={selectClass}
              >
                <option value="">Semua tema</option>
                {options.themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </div>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" className="h-9">
              Terapkan filter
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-9">
              <Link href="/admin/analitik">Atur ulang</Link>
            </Button>
            <p className="text-xs text-ink-muted">
              {overview.period.label} · dasar {overview.period.attributionLabel}
            </p>
          </div>
        </form>
      </section>

      <section
        aria-label="Indikator utama analitik"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Konten disetujui"
          value={formatNumberId(approved.value)}
          hint={
            approved.target === null
              ? "Target belum ditetapkan"
              : `Target ${formatNumberId(approved.target)} konten · ${targetSourceLabel(approved.targetSource)}`
          }
          icon={BadgeCheck}
          tone="green"
        />
        <StatCard
          label="Capaian target"
          value={formatPercent(approved.achievement)}
          hint={
            approved.target === null
              ? "Tidak ada target pada cakupan filter ini"
              : approved.target === 0
                ? "Target 0 tidak dapat dihitung"
                : "Dihitung dari konten disetujui"
          }
          icon={Gauge}
          tone={approved.achievement !== null && approved.achievement >= 100 ? "green" : "amber"}
        />
        <StatCard
          label="Tingkat persetujuan"
          value={formatPercent(overview.approvalRate)}
          hint={`${formatNumberId(overview.approvedDecisions)} setuju dari ${formatNumberId(overview.reviewed)} keputusan pada periode`}
          icon={Percent}
          tone="teal"
        />
        <StatCard
          label="Median waktu validasi"
          value={formatDays(overview.leadTimeMedianDays)}
          hint={`${formatNumberId(overview.approvalSamples)} sampel keputusan disetujui`}
          icon={Clock3}
          tone="blue"
        />
      </section>

      <section
        aria-labelledby="chart-bulanan"
        className="rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        <h2 id="chart-bulanan" className="text-base font-semibold text-foreground">
          Tren enam bulan
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Konten disetujui per bulan dibandingkan dengan konten yang dikirim
          pada bulan tersebut. Filter stakeholder dan tema tetap berlaku.
        </p>
        <LazyMonthlyTrendChart data={monthly} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section
          aria-labelledby="analitik-rincian"
          className="rounded-xl border border-border bg-surface shadow-sm"
        >
          <div className="border-b border-border px-5 py-3">
            <h2 id="analitik-rincian" className="text-base font-semibold text-foreground">
              Rincian metrik periode
            </h2>
            <p className="text-xs text-ink-muted">
              Angka mengikuti filter dan dasar tanggal yang aktif.
            </p>
          </div>
          <dl className="divide-y divide-border/70 text-sm">
            {[
              ["Konten dikirim pada periode", formatNumberId(overview.submitted)],
              ["Menunggu keputusan", formatNumberId(overview.pending)],
              ["Perlu revisi", formatNumberId(overview.revision)],
              ["Keputusan admin", formatNumberId(overview.reviewed)],
              ["Keputusan setuju", formatNumberId(overview.approvedDecisions)],
              ["Rata-rata waktu validasi", formatDays(overview.leadTimeAverageDays)],
              ["Periode sebelumnya", formatNumberId(overview.previousApproved)],
              [
                "Pertumbuhan",
                overview.growth === null
                  ? "N/A"
                  : `${overview.growth > 0 ? "+" : ""}${formatNumberId(overview.growth)}%`,
              ],
              ["Stakeholder aktif", formatNumberId(overview.activeStakeholders)],
              ["Sumber target", targetSourceLabel(approved.targetSource)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 px-5 py-2.5"
              >
                <dt className="text-ink-muted">{label}</dt>
                <dd className="font-medium text-foreground tabular">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="analitik-top"
          className="rounded-xl border border-border bg-surface shadow-sm"
        >
          <div className="border-b border-border px-5 py-3">
            <h2 id="analitik-top" className="text-base font-semibold text-foreground">
              Kontributor teratas
            </h2>
            <p className="text-xs text-ink-muted">
              Sepuluh stakeholder dengan konten disetujui terbanyak pada filter
              ini.
            </p>
          </div>
          {topStakeholders.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-ink-muted">
              Belum ada konten disetujui dari stakeholder pada filter ini.
            </div>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">
                  Peringkat stakeholder berdasarkan konten disetujui
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                    <th scope="col" className="px-5 py-2.5">Peringkat</th>
                    <th scope="col" className="px-5 py-2.5">Stakeholder</th>
                    <th scope="col" className="px-5 py-2.5 text-right">Disetujui</th>
                  </tr>
                </thead>
                <tbody>
                  {topStakeholders.map((row, index) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/70 last:border-0"
                    >
                      <td className="px-5 py-2.5 text-ink-muted tabular">
                        {index + 1}
                      </td>
                      <td className="px-5 py-2.5 font-medium text-foreground">
                        {row.name}
                      </td>
                      <td className="px-5 py-2.5 text-right text-foreground tabular">
                        {formatNumberId(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section
        aria-labelledby="analitik-konten"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
          <div>
            <h2 id="analitik-konten" className="text-base font-semibold text-foreground">
              Konten disetujui dalam periode
            </h2>
            <p className="text-xs text-ink-muted">
              Maksimal 100 konten terbaru berdasarkan {overview.period.attributionLabel}.
            </p>
          </div>
          <Link
            href="/admin/konten?status=APPROVED"
            className="text-xs font-semibold text-brand-blue-700 underline underline-offset-4"
          >
            Lihat seluruh konten
          </Link>
        </div>
        {overview.approvedItems.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-muted">
            Belum ada konten disetujui pada periode dan filter ini.
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <caption className="sr-only">
                Konten disetujui pada periode analitik
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-5 py-3">Konten</th>
                  <th scope="col" className="px-5 py-3">Stakeholder</th>
                  <th scope="col" className="px-5 py-3">Tema</th>
                  <th scope="col" className="px-5 py-3">Disetujui</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.approvedItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/70 align-top last:border-0"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/validasi/${item.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {item.title ?? "(tanpa judul)"}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {item.referenceCode}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {item.stakeholderName}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{item.themeName}</td>
                    <td className="px-5 py-3 text-ink-muted">
                      {formatDateTimeId(item.approvedAt)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button asChild size="sm" variant="outline" className="h-9">
                        <Link href={`/admin/validasi/${item.id}`}>Buka</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Distribusi konten" className="grid gap-6 xl:grid-cols-3">
        <DistributionCard
          title="Jenis konten"
          description="Video dan infografis yang disetujui."
          rows={contentType}
        />
        <DistributionCard
          title="Tema utama"
          description="EDUFAST dan Non-EDUFAST."
          rows={mainTheme}
        />
        <DistributionCard
          title="Sub-tema"
          description="Enam sub-tema kanonik."
          rows={subTheme}
        />
      </section>

      <section
        aria-labelledby="edufast-compliance"
        className="rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        <h2 id="edufast-compliance" className="text-base font-semibold text-foreground">
          Kepatuhan EDUFAST
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Konten EDUFAST dibandingkan dengan seluruh konten disetujui yang memiliki
          tema pada periode aktif.
        </p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-muted">Konten EDUFAST</dt>
            <dd className="font-medium text-foreground tabular">
              {formatNumberId(compliance.edufastApproved)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Konten Non-EDUFAST</dt>
            <dd className="font-medium text-foreground tabular">
              {formatNumberId(compliance.nonEdufastApproved)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Porsi EDUFAST</dt>
            <dd className="font-medium text-foreground tabular">
              {formatPercent(
                compliance.edufastApproved + compliance.nonEdufastApproved === 0
                  ? null
                  : (compliance.edufastApproved /
                      (compliance.edufastApproved + compliance.nonEdufastApproved)) *
                      100,
              )}
            </dd>
          </div>
        </dl>
      </section>

      <RankingsTable rows={rankings} />

      <section
        aria-labelledby="red-notice-summary"
        className="rounded-xl border border-status-rejected/30 bg-status-rejected/5 p-5"
      >
        <h2 id="red-notice-summary" className="text-base font-semibold text-foreground">
          Red Notice
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {formatNumberId(redNotice.neverSubmitted.length)} dari{" "}
          {formatNumberId(redNotice.totalFaskes)} Faskes aktif belum pernah mengirim
          konten sepanjang masa. Daftar periode tidak aktif ({formatNumberId(
            redNotice.inactiveInPeriod.length,
          )}) dipisahkan agar tidak tertukar dengan nol seumur hidup.
        </p>
        <Button asChild variant="outline" className="mt-3 h-10">
          <Link href="/admin/red-notice">Buka Red Notice lengkap</Link>
        </Button>
      </section>

      <p className="text-xs text-ink-muted">
        <ClipboardList className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
        Metrik dihitung ulang langsung dari tabel konten pada setiap permintaan -
        tidak ada penghitung tersimpan yang dapat melenceng. Zona waktu: Asia/Jakarta.
      </p>
    </div>
  );
}
