import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
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
import {
  DeferredAllContentCharts,
  DeferredApprovedCharts,
} from "@/components/dashboard/dashboard-analytics-lazy";
import { DashboardMapSection } from "@/components/dashboard/dashboard-map";
import { StatCard } from "@/components/dashboard/stat-card";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import type { DashboardAnalytics } from "@/lib/analytics/charts";
import { PLATFORM_LABEL } from "@/lib/content-status";
import type { DashboardMap } from "@/lib/dashboard-map";
import { formatDateId, formatDateTimeId, formatNumberId } from "@/lib/dates";
import { MAP_STYLE_URL } from "@/lib/geo";
import type { FilterOption } from "@/lib/filters/query";
import {
  achievementPercent,
  targetSourceLabel,
  type DashboardOverview,
  type DrilldownItem,
} from "@/lib/kpi/formulas";
import { periodOptions } from "@/lib/periods";
import type { AppRole } from "@/lib/session";

type Alignment = {
  approved: number;
  target: number | null;
  institutions: number;
  withTarget: number;
  periodKey: string;
  periodLabel: string;
};

function dashboardPeriodOptions(
  selected: string,
  selectedLabel: string,
): FilterOption[] {
  const { months, quarters, years } = periodOptions();
  const flat = [...months, ...quarters, ...years];
  if (flat.some((option) => option.value === selected)) return flat;
  return [{ value: selected, label: selectedLabel }, ...flat];
}

function formatPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatDays(value: number | null): string {
  if (value === null) return "N/A";
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)} hari`;
}

function comparisonLabel(periodKey: string): string {
  if (/^\d{4}$/.test(periodKey)) return "tahun lalu";
  if (/Q[1-4]$/.test(periodKey)) return "triwulan sebelumnya";
  return "bulan lalu";
}

function GrowthNote({
  current,
  previous,
  growth,
  comparison,
}: {
  current: number;
  previous: number;
  growth: number | null;
  comparison: string;
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
      {formatPercent(growth)} vs {comparison}
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

function SectionBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted">
      {children}
    </span>
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
          <p className="mt-3 text-sm font-medium text-foreground">
            {emptyTitle}
          </p>
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
  analytics,
  role,
  options,
  basePath,
  title,
  description,
  headerActions,
  notice,
  contentDetailBase,
  hideHeader,
  alignment,
  map,
}: {
  overview: DashboardOverview;
  analytics: DashboardAnalytics;
  role: AppRole;
  options: {
    stakeholders: FilterOption[];
    subThemes: FilterOption[];
  };
  basePath: string;
  title: string;
  description: string;
  headerActions?: ReactNode;
  notice?: ReactNode;
  contentDetailBase: string;
  /** Header dirender oleh page agar bisa streaming sebelum data siap. */
  hideHeader?: boolean;
  /** Ringkasan target per instansi dari menu Kinerja agar angka dasbor identik. */
  alignment?: Alignment | null;
  /** Agregasi peta server-side; tidak memuat seluruh konten ke browser. */
  map?: DashboardMap | null;
}) {
  const { approved } = overview;
  const headlineApproved = alignment ? alignment.approved : approved.value;
  const headlineTarget = alignment ? alignment.target : approved.target;
  const headlineAchievement = alignment
    ? achievementPercent(alignment.approved, alignment.target)
    : approved.achievement;
  const targetMissing = headlineTarget === null;
  const zeroTarget = headlineTarget === 0;
  const progress =
    headlineAchievement === null ? 0 : Math.min(100, headlineAchievement);
  const isMaster = role === "MASTER_ADMIN";
  const isBranch = role === "BRANCH_ADMIN";
  const isStakeholder = role === "STAKEHOLDER";
  const showStakeholderFilter =
    !isStakeholder || options.stakeholders.length > 1;
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

  const csvParams = new URLSearchParams();
  csvParams.set("period", overview.period.key);
  csvParams.set("status", "APPROVED");
  if (overview.filters.stakeholderId) {
    csvParams.set("stakeholderId", overview.filters.stakeholderId);
  }
  if (overview.filters.subTheme) {
    csvParams.set("subTheme", overview.filters.subTheme);
  }
  csvParams.set("attribution", overview.filters.attribution);
  const csvHref = `/api/v1/exports/submissions?${csvParams.toString()}`;

  const filterFields: FilterField[] = [
    {
      kind: "select",
      name: "period",
      label: "Periode capaian",
      value: overview.period.key,
      options: dashboardPeriodOptions(
        overview.period.key,
        overview.period.label,
      ),
      allLabel: "",
      includeEmpty: false,
    },
    ...(showStakeholderFilter
      ? [
          {
            kind: "select" as const,
            name: "stakeholderId",
            label: "Stakeholder",
            value: overview.filters.stakeholderId ?? "",
            options: options.stakeholders,
            allLabel: isStakeholder
              ? "Semua organisasi saya"
              : "Semua organisasi",
          },
        ]
      : []),
    {
      kind: "select",
      name: "subTheme",
      label: "Sub-tema",
      value: overview.filters.subTheme ?? "",
      options: options.subThemes,
      allLabel: "Semua sub-tema",
    },
    {
      kind: "select",
      name: "attribution",
      label: "Dasar tanggal capaian",
      value: overview.filters.attribution,
      options: [
        { value: "approved_at", label: "Tanggal disetujui" },
        { value: "date_created", label: "Tanggal konten dibuat" },
      ],
      allLabel: "",
      includeEmpty: false,
    },
  ];

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
    <div className="space-y-6">
      {hideHeader ? null : (
        <PageHeader
          title={title}
          description={description}
          actions={
            <div className="flex flex-col items-start gap-2 sm:items-end">
              {headerActions}
              <p className="text-xs text-ink-muted">
                Diperbarui {formatDateTimeId(overview.generatedAt)} WIB
              </p>
            </div>
          }
        />
      )}

      {notice}

      <FilterBar
        action={basePath}
        label="Filter dasbor"
        idPrefix="kpi"
        resetHref={basePath}
        fields={filterFields}
        summary="Filter tersimpan di URL sehingga dapat dibagikan dan dimuat ulang."
        actions={
          <Button asChild variant="outline" size="sm" className="h-9">
            <a href={csvHref}>
              <Download className="size-3.5" aria-hidden />
              Unduh CSV
            </a>
          </Button>
        }
      />

      <section
        aria-label="Capaian utama"
        className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
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
                {formatNumberId(headlineApproved)}
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
                      : `${formatPercent(headlineAchievement)} dari target`}
                </span>
                <span className="font-medium text-foreground tabular">
                  {targetMissing
                    ? "N/A"
                    : `${formatNumberId(headlineTarget ?? 0)} konten`}
                </span>
              </div>
              <div
                className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-muted"
                role={targetMissing || zeroTarget ? undefined : "progressbar"}
                aria-valuemin={targetMissing || zeroTarget ? undefined : 0}
                aria-valuemax={targetMissing || zeroTarget ? undefined : 100}
                aria-valuenow={
                  targetMissing || zeroTarget ? undefined : Math.round(progress)
                }
                aria-label={
                  targetMissing || zeroTarget
                    ? undefined
                    : "Persentase capaian terhadap target"
                }
              >
                <div
                  className={`h-full rounded-full ${
                    headlineAchievement !== null && headlineAchievement >= 100
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
                    : alignment
                      ? `Target dijumlahkan dari target bulanan ${formatNumberId(alignment.institutions)} instansi aktif (${formatNumberId(alignment.withTarget)} memiliki target). Angka ini sama dengan menu Kinerja.`
                      : `${targetSourceLabel(approved.targetSource)} untuk ${overview.period.label}.`}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <GrowthNote
                current={headlineApproved}
                previous={overview.previousApproved}
                growth={overview.growth}
                comparison={comparisonLabel(overview.period.key)}
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
              label="Periode sebelumnya"
              value={formatNumberId(overview.previousApproved)}
              hint="Konten disetujui"
            />
          </div>
        </div>
      </section>

      <section
        aria-label="Indikator pendukung"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
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

      <nav
        aria-label="Bagian dashboard"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <a
          href="#semua-konten"
          className="rounded-full border border-border bg-surface px-3 py-1.5 font-medium text-foreground transition hover:border-brand-blue-300 hover:text-brand-blue-700"
        >
          Semua konten
        </a>
        <a
          href="#konten-disetujui"
          className="rounded-full border border-border bg-surface px-3 py-1.5 font-medium text-foreground transition hover:border-brand-blue-300 hover:text-brand-blue-700"
        >
          Konten disetujui
        </a>
        {map ? (
          <a
            href="#peta"
            className="rounded-full border border-border bg-surface px-3 py-1.5 font-medium text-foreground transition hover:border-brand-blue-300 hover:text-brand-blue-700"
          >
            Peta
          </a>
        ) : null}
        <a
          href="#tabel"
          className="rounded-full border border-border bg-surface px-3 py-1.5 font-medium text-foreground transition hover:border-brand-blue-300 hover:text-brand-blue-700"
        >
          Tabel
        </a>
      </nav>

      <section
        id="semua-konten"
        aria-labelledby="semua-konten-heading"
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
      >
        <header className="border-b border-border bg-surface-muted/50 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="semua-konten-heading"
              className="text-lg font-semibold text-foreground"
            >
              Semua konten
            </h2>
            <SectionBadge>Semua status</SectionBadge>
            <SectionBadge>Basis tanggal dibuat</SectionBadge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            Draf, menunggu validasi, perlu revisi, ditolak, dicabut, dan
            disetujui dihitung dengan basis tanggal konten dibuat agar volume
            pengajuan terlihat utuh.
          </p>
        </header>
        <div className="p-4 sm:p-5">
          <DeferredAllContentCharts data={analytics.allContent} />
        </div>
      </section>

      <section
        id="konten-disetujui"
        aria-labelledby="konten-disetujui-heading"
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-brand-teal-200 bg-surface shadow-sm"
      >
        <header className="border-b border-brand-teal-200 bg-brand-teal-100/40 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="konten-disetujui-heading"
              className="text-lg font-semibold text-foreground"
            >
              Konten disetujui
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal-100 px-2.5 py-1 text-xs font-medium text-brand-teal-700">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Hanya status Disetujui
            </span>
            <SectionBadge>Basis tanggal disetujui</SectionBadge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            Capaian, peringkat, dan kepatuhan EDUFAST hanya menghitung konten
            yang benar-benar disetujui pada periode, bukan seluruh kiriman.
          </p>
        </header>
        <div className="p-4 sm:p-5">
          <DeferredApprovedCharts
            data={analytics.approved}
            target={{ approved: headlineApproved, target: headlineTarget }}
          />
        </div>
      </section>

      {map ? (
        <div id="peta" className="scroll-mt-24">
          <DashboardMapSection map={map} styleUrl={MAP_STYLE_URL} />
        </div>
      ) : null}

      <div id="tabel" className="scroll-mt-24 space-y-6">
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
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-brand-blue-100 bg-brand-blue-100/40 p-4 text-sm leading-relaxed text-brand-blue-800">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Bagian <strong>Semua konten</strong> menghitung setiap status dengan
          basis tanggal dibuat. Bagian <strong>Konten disetujui</strong> hanya
          menghitung status Disetujui dengan basis tanggal disetujui; konten
          ditolak, perlu revisi, dicabut, atau diarsipkan tidak menambah
          capaian.
        </p>
      </div>
    </div>
  );
}
