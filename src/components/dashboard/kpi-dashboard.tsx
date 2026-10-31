import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  Info,
  RotateCcw,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { ContentTypeBadge } from "@/components/content/content-type-badge";
import { StatusBadge } from "@/components/content/status-badge";
import { DeferredKpiCharts } from "@/components/dashboard/kpi-charts-lazy";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { PLATFORM_LABEL } from "@/lib/content-status";
import { formatDateId, formatDateTimeId, formatNumberId } from "@/lib/dates";
import {
  targetSourceLabel,
  type DashboardOverview,
  type DrilldownItem,
} from "@/lib/kpi/formulas";
import type { AppRole } from "@/lib/session";

const selectClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none";

function formatPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatDays(value: number | null): string {
  if (value === null) return "N/A";
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)} hari`;
}

function GrowthNote({
  current,
  previous,
  growth,
}: {
  current: number;
  previous: number;
  growth: number | null;
}) {
  if (growth === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
        Pertumbuhan N/A · baseline 0
      </span>
    );
  }

  const positive = growth >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        positive
          ? "bg-status-approved/10 text-status-approved"
          : "bg-status-rejected/10 text-status-rejected"
      }`}
    >
      <Icon className="size-3.5" aria-hidden />
      {positive ? "+" : ""}
      {formatPercent(growth)} vs bulan lalu
      <span className="font-normal text-ink-muted">
        ({formatNumberId(previous)} → {formatNumberId(current)})
      </span>
    </span>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted/50 px-3 py-2.5">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-foreground tabular">
        {value}
      </p>
      {hint ? <p className="text-[11px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function ContentTable({
  items,
  detailBase,
  title,
  subtitle,
  actionHref,
  actionLabel,
  emptyTitle,
  emptyBody,
  showStatus,
}: {
  items: DrilldownItem[];
  detailBase: string;
  title: string;
  subtitle: string;
  actionHref: string;
  actionLabel: string;
  emptyTitle: string;
  emptyBody: string;
  showStatus: boolean;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-ink-muted">{subtitle}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={actionHref}>
            {actionLabel}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <FileText className="mx-auto size-8 text-ink-muted" aria-hidden />
          <p className="mt-3 text-sm font-medium text-foreground">{emptyTitle}</p>
          <p className="mt-1 text-sm text-ink-muted">{emptyBody}</p>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                <th scope="col" className="px-5 py-3">
                  Konten
                </th>
                <th scope="col" className="px-5 py-3">
                  Jenis konten
                </th>
                <th scope="col" className="px-5 py-3">
                  Tema
                </th>
                <th scope="col" className="px-5 py-3">
                  Platform
                </th>
                <th scope="col" className="px-5 py-3">
                  Tanggal
                </th>
                {showStatus ? (
                  <th scope="col" className="px-5 py-3">
                    Status
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border/70 last:border-0 hover:bg-surface-muted/60"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`${detailBase}/${item.id}`}
                      className="font-medium text-foreground underline-offset-4 hover:text-brand-blue-700 hover:underline"
                    >
                      {item.title ?? "(tanpa judul)"}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {item.referenceCode} · {item.stakeholderName}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <ContentTypeBadge contentType={item.contentType} />
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{item.themeName}</td>
                  <td className="px-5 py-3 text-ink-muted">
                    {PLATFORM_LABEL[item.platform] ?? item.platform}
                  </td>
                  <td className="px-5 py-3 text-ink-muted">
                    {formatDateId(item.approvedAt ?? item.updatedAt)}
                  </td>
                  {showStatus ? (
                    <td className="px-5 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function KpiDashboard({
  overview,
  role,
  options,
  basePath,
  title,
  description,
  headerActions,
  notice,
  contentDetailBase,
  stakeholderChartTitle,
  hideHeader,
}: {
  overview: DashboardOverview;
  role: AppRole;
  options: {
    stakeholders: Array<{ id: string; name: string }>;
    themes: Array<{ id: string; name: string }>;
    months: Array<{ key: string; label: string }>;
  };
  basePath: string;
  title: string;
  description: string;
  headerActions?: ReactNode;
  notice?: ReactNode;
  contentDetailBase: string;
  stakeholderChartTitle: string;
  /** Header dirender oleh page agar bisa streaming sebelum data siap. */
  hideHeader?: boolean;
}) {
  const { approved } = overview;
  const targetMissing = approved.target === null;
  const zeroTarget = approved.target === 0;
  const progress =
    approved.achievement === null ? 0 : Math.min(100, approved.achievement);
  const isMaster = role === "MASTER_ADMIN";
  const isBranch = role === "BRANCH_ADMIN";
  const isStakeholder = role === "STAKEHOLDER";
  const showStakeholderFilter = !isStakeholder || options.stakeholders.length > 1;
  const contentListHref = isMaster
    ? "/admin/konten"
    : isBranch
      ? "/cabang/konten"
      : isStakeholder
        ? "/client/konten"
        : "/wilayah/konten";
  const reviewQueueHref = isMaster
    ? "/admin/validasi"
    : isBranch
      ? "/cabang/review"
      : isStakeholder
        ? "/client/konten"
        : "/wilayah/konten";

  const scopeParts = [overview.period.label];
  if (overview.scope.stakeholderName) {
    scopeParts.push(`Stakeholder: ${overview.scope.stakeholderName}`);
  } else if (overview.scope.restricted) {
    scopeParts.push(
      `${overview.scope.stakeholderIds.length} stakeholder dalam lingkup Anda`,
    );
  }
  if (overview.scope.themeName) {
    scopeParts.push(`Tema: ${overview.scope.themeName}`);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {hideHeader ? null : (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {headerActions}
            <p className="text-xs text-ink-muted">
              Diperbarui {formatDateTimeId(overview.generatedAt)} WIB
            </p>
          </div>
        </header>
      )}

      {notice}

      <section
        aria-label="Filter dasbor"
        className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
      >
        <form method="get" action={basePath} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Gauge className="size-4 text-brand-blue-600" aria-hidden />
            Filter capaian
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label htmlFor="kpi-month" className="text-xs font-medium text-ink-muted">
                Periode bulan
              </label>
              <select
                id="kpi-month"
                name="month"
                defaultValue={overview.filters.month}
                className={selectClass}
              >
                {options.months.map((month) => (
                  <option key={month.key} value={month.key}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            {showStakeholderFilter ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="kpi-stakeholder"
                  className="text-xs font-medium text-ink-muted"
                >
                  Stakeholder
                </label>
                <select
                  id="kpi-stakeholder"
                  name="stakeholderId"
                  defaultValue={overview.filters.stakeholderId ?? ""}
                  className={selectClass}
                >
                  <option value="">
                    {isStakeholder ? "Semua organisasi saya" : "Semua organisasi"}
                  </option>
                  {options.stakeholders.map((stakeholder) => (
                    <option key={stakeholder.id} value={stakeholder.id}>
                      {stakeholder.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label htmlFor="kpi-theme" className="text-xs font-medium text-ink-muted">
                Tema
              </label>
              <select
                id="kpi-theme"
                name="subTheme"
                defaultValue={overview.filters.subTheme ?? ""}
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
                htmlFor="kpi-attribution"
                className="text-xs font-medium text-ink-muted"
              >
                Dasar tanggal capaian
              </label>
              <select
                id="kpi-attribution"
                name="attribution"
                defaultValue={overview.filters.attribution}
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
              <Link href={basePath}>Atur ulang</Link>
            </Button>
            <p className="text-xs text-ink-muted">
              Filter tersimpan di URL sehingga dapat dibagikan dan dimuat ulang.
            </p>
          </div>
        </form>
      </section>

      <section
        aria-label="Capaian utama"
        className="rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold tracking-wide text-brand-blue-700 uppercase">
                Capaian periode
              </p>
              <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-ink-muted">
                {scopeParts.join(" · ")}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="text-4xl font-semibold tracking-tight text-foreground tabular">
                {formatNumberId(approved.value)}
              </p>
              <p className="pb-1 text-sm text-ink-muted">
                konten disetujui berdasarkan {overview.period.attributionLabel}
              </p>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">
                  {targetMissing
                    ? "Target belum ditetapkan"
                    : zeroTarget
                      ? "Target bernilai 0"
                      : `${formatPercent(approved.achievement)} dari target`}
                </span>
                <span className="font-medium text-foreground tabular">
                  {targetMissing ? "N/A" : `${formatNumberId(approved.target ?? 0)} konten`}
                </span>
              </div>
              <div
                className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-muted"
                role={targetMissing || zeroTarget ? undefined : "progressbar"}
                aria-valuemin={targetMissing || zeroTarget ? undefined : 0}
                aria-valuemax={targetMissing || zeroTarget ? undefined : 100}
                aria-valuenow={targetMissing || zeroTarget ? undefined : Math.round(progress)}
                aria-label={
                  targetMissing || zeroTarget
                    ? undefined
                    : "Persentase capaian terhadap target"
                }
              >
                <div
                  className={`h-full rounded-full ${
                    approved.achievement !== null && approved.achievement >= 100
                      ? "bg-status-approved"
                      : "bg-brand-blue-500"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {targetMissing
                  ? "Kombinasi filter ini belum memiliki target. Capaian ditampilkan N/A agar tidak memakai target dari lingkup lain."
                  : zeroTarget
                    ? "Target 0 tidak dapat dipakai sebagai pembagi, sehingga capaian ditampilkan N/A."
                    : `${targetSourceLabel(approved.targetSource)} untuk ${overview.period.label}.`}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <GrowthNote
                current={approved.value}
                previous={overview.previousApproved}
                growth={overview.growth}
              />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal-100 px-2.5 py-1 text-xs font-medium text-brand-teal-700">
                <CheckCircle2 className="size-3.5" aria-hidden />
                Hanya status Disetujui yang dihitung
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat
              label="Konten dikirim"
              value={formatNumberId(overview.submitted)}
              hint="Pada periode ini"
            />
            <MiniStat
              label="Keputusan ditinjau"
              value={formatNumberId(overview.reviewed)}
              hint={`${overview.approvedDecisions} disetujui`}
            />
            <MiniStat
              label={isStakeholder ? "Perlu revisi" : "Organisasi aktif"}
              value={formatNumberId(
                isStakeholder ? overview.revision : overview.activeStakeholders,
              )}
              hint={
                isStakeholder
                  ? "Menunggu perbaikan Anda"
                  : "Punya kiriman di periode"
              }
            />
            <MiniStat
              label="Bulan sebelumnya"
              value={formatNumberId(overview.previousApproved)}
              hint="Konten disetujui"
            />
          </div>
        </div>
      </section>

      <section aria-label="Indikator pendukung" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tingkat persetujuan"
          value={formatPercent(overview.approvalRate)}
          hint={`${formatNumberId(overview.approvedDecisions)} dari ${formatNumberId(overview.reviewed)} keputusan pada periode`}
          icon={Gauge}
          tone="blue"
        />
        <StatCard
          label="Waktu tinjau (median)"
          value={formatDays(overview.leadTimeMedianDays)}
          hint={`Rata-rata ${formatDays(overview.leadTimeAverageDays)} · ${formatNumberId(overview.approvalSamples)} sampel`}
          icon={Timer}
          tone="teal"
        />
        <StatCard
          label="Menunggu validasi"
          value={formatNumberId(overview.pending)}
          hint="Terkirim atau sedang ditinjau pada periode"
          icon={Clock3}
          tone="amber"
        />
        {!isStakeholder ? (
          <StatCard
            label="Organisasi aktif"
            value={formatNumberId(overview.activeStakeholders)}
            hint="Mengirim konten pada periode"
            icon={Building2}
            tone="green"
          />
        ) : (
          <StatCard
            label="Perlu revisi"
            value={formatNumberId(overview.revision)}
            hint="Konten menunggu perbaikan Anda"
            icon={RotateCcw}
            tone="red"
          />
        )}
      </section>

      <DeferredKpiCharts
        trend={overview.trend}
        statusCounts={overview.statusCounts}
        themes={overview.themes}
        stakeholders={overview.stakeholders}
        attributionLabel={overview.period.attributionLabel}
        stakeholderTitle={stakeholderChartTitle}
      />

      <ContentTable
        items={overview.approvedItems}
        detailBase={contentDetailBase}
        title="Konten disetujui pada periode"
        subtitle={`Maksimal 100 konten terbaru berdasarkan ${overview.period.attributionLabel}.`}
        actionHref={contentListHref}
        actionLabel="Lihat semua konten"
        emptyTitle="Belum ada konten disetujui"
        emptyBody="Konten yang disetujui pada filter ini akan muncul di sini."
        showStatus={false}
      />

      <ContentTable
        items={overview.pendingItems}
        detailBase={contentDetailBase}
        title={
          isStakeholder
            ? "Konten Anda menunggu validasi"
            : "Menunggu validasi pada periode"
        }
        subtitle="Lima kiriman paling lama yang belum diputuskan."
        actionHref={reviewQueueHref}
        actionLabel={isStakeholder ? "Lihat konten saya" : "Buka antrean"}
        emptyTitle="Antrean periode ini kosong"
        emptyBody="Semua kiriman pada periode ini sudah diputuskan."
        showStatus
      />

      {isStakeholder ? (
        <ContentTable
          items={overview.recentItems}
          detailBase="/client/konten"
          title="Konten terbaru Anda"
          subtitle="Lima konten dengan pembaruan terakhir."
          actionHref="/client/konten"
          actionLabel="Lihat semua"
          emptyTitle="Belum ada konten"
          emptyBody="Konten yang Anda kirim akan muncul di sini."
          showStatus
        />
      ) : null}

      <div className="flex items-start gap-2 rounded-xl border border-brand-blue-100 bg-brand-blue-100/40 p-4 text-sm leading-relaxed text-brand-blue-800">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Angka capaian dihitung ulang dari database pada setiap permintaan dan
          hanya memakai konten berstatus <strong>Disetujui</strong>. Konten
          ditolak, perlu revisi, dicabut, atau diarsipkan tidak menambah
          capaian.
        </p>
      </div>
    </div>
  );
}
