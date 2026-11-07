import { Activity, CheckCircle2, Clock, Inbox } from "lucide-react";

import { ChartFrame, ChartLegendChip } from "@/components/charts/chart-frame";
import { StatusBadge } from "@/components/content/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { STATUS_CHART_COLOR } from "@/lib/chart-theme";
import { STATUS_LABEL, type ContentStatus } from "@/lib/content-status";
import { formatNumberId } from "@/lib/dates";
import type { SlaAnalytics } from "@/lib/analytics/sla";
import { periodLabel } from "@/lib/taxonomy";

const VOLUME_SEGMENTS = [
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Disetujui" },
  { key: "revision", label: "Revisi" },
  { key: "rejected", label: "Ditolak" },
  { key: "draft", label: "Draf" },
] as const;

const SEGMENT_COLOR: Record<(typeof VOLUME_SEGMENTS)[number]["key"], string> = {
  pending: "var(--status-review)",
  approved: "var(--status-approved)",
  revision: "var(--status-revision)",
  rejected: "var(--status-rejected)",
  draft: "var(--status-draft)",
};

function barWidth(value: number, max: number): string {
  if (max <= 0) return "0%";
  return `${Math.max(1, Math.round((value / max) * 100))}%`;
}

export function SlaAnalyticsView({ analytics }: { analytics: SlaAnalytics }) {
  const { summary } = analytics;
  const volumeMax = Math.max(
    1,
    ...analytics.volume.map((point) => point.total),
  );
  const statusMax = Math.max(
    1,
    ...analytics.statusCounts.map((row) => row.total),
  );
  const agingMax = Math.max(1, ...analytics.aging.map((row) => row.total));
  const funnelMax = Math.max(
    1,
    ...analytics.funnel.stages.map((row) => row.total),
    ...analytics.funnel.outcomes.map((row) => row.total),
  );
  const hasData = summary.submitted > 0;

  return (
    <div className="space-y-6">
      <section
        aria-label="Ringkasan operasional SLA"
        className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-blue-700 uppercase">
              Operasional {periodLabel(analytics.period)}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Semua status dihitung menurut tanggal konten dibuat. Angka ini
              tidak dipakai pada Dashboard capaian.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
            <Activity className="size-3.5" aria-hidden />
            Semua status
          </span>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Menunggu keputusan"
            value={formatNumberId(summary.pending)}
            hint="Terkirim, kirim ulang, dan ditinjau"
            icon={Inbox}
            tone={summary.pending > 0 ? "amber" : "teal"}
          />
          <StatCard
            label="Perlu revisi"
            value={formatNumberId(summary.revision)}
            hint="Menunggu perbaikan pengirim"
            icon={Clock}
            tone={summary.revision > 0 ? "red" : "teal"}
          />
          <StatCard
            label="Disetujui"
            value={formatNumberId(summary.approved)}
            hint="Keputusan approval final pada periode"
            icon={CheckCircle2}
            tone="green"
          />
          <StatCard
            label="Rasio approval"
            value={
              summary.approvalRate === null
                ? "N/A"
                : `${formatNumberId(summary.approvalRate)}%`
            }
            hint="Disetujui dibagi seluruh keputusan"
            icon={Activity}
            tone="blue"
          />
        </div>
      </section>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-12 text-center text-sm text-ink-muted">
          Belum ada konten pada filter ini.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartFrame
            title="Volume pengiriman"
            description="Jumlah konten masuk per bulan menurut tanggal dibuat, semua status."
            empty={analytics.volume.every((point) => point.total === 0)}
          >
            <div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {VOLUME_SEGMENTS.map((segment) => (
                  <ChartLegendChip
                    key={segment.key}
                    color={SEGMENT_COLOR[segment.key]}
                    label={segment.label}
                  />
                ))}
              </div>
              <ul className="space-y-2">
                {analytics.volume.map((point) => (
                  <li key={point.month}>
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="text-ink-muted">{point.label}</span>
                      <span className="font-semibold text-foreground tabular">
                        {formatNumberId(point.total)}
                      </span>
                    </div>
                    <div
                      className="mt-1 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
                      role="img"
                      aria-label={`${point.label}: ${point.total} konten, ${point.pending} menunggu, ${point.approved} disetujui, ${point.revision} revisi, ${point.rejected} ditolak`}
                    >
                      {VOLUME_SEGMENTS.map((segment) => {
                        const value = point[segment.key];
                        if (value <= 0) return null;
                        return (
                          <span
                            key={segment.key}
                            style={{
                              width: barWidth(value, volumeMax),
                              backgroundColor: SEGMENT_COLOR[segment.key],
                            }}
                          />
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </ChartFrame>

          <ChartFrame
            title="Komposisi status"
            description="Status terkini konten yang dibuat pada periode terpilih."
            empty={analytics.statusCounts.length === 0}
          >
            <ul className="space-y-2">
              {analytics.statusCounts.map((row) => (
                <li key={row.status} className="flex items-center gap-3">
                  <div className="w-32 shrink-0">
                    <StatusBadge status={row.status as ContentStatus} />
                  </div>
                  <div className="h-2.5 flex-1 rounded-full bg-surface-muted">
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: barWidth(row.total, statusMax),
                        backgroundColor:
                          STATUS_CHART_COLOR[row.status as ContentStatus],
                      }}
                      role="img"
                      aria-label={`${STATUS_LABEL[row.status as ContentStatus]}: ${row.total}`}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-sm font-semibold text-foreground tabular">
                    {formatNumberId(row.total)}
                  </span>
                </li>
              ))}
            </ul>
          </ChartFrame>

          <ChartFrame
            title="Usia antrean berjalan"
            description="Lama waktu sejak pengiriman pertama untuk konten yang belum diputuskan."
            empty={analytics.aging.every((row) => row.total === 0)}
          >
            <ul className="space-y-3">
              {analytics.aging.map((row) => (
                <li key={row.bucket}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-ink-muted">{row.label}</span>
                    <span className="font-semibold text-foreground tabular">
                      {formatNumberId(row.total)}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-surface-muted">
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: barWidth(row.total, agingMax),
                        backgroundColor: "var(--chart-2)",
                      }}
                      role="img"
                      aria-label={`${row.label}: ${row.total} konten`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </ChartFrame>

          <ChartFrame
            title="Corong keputusan"
            description="Kohort konten pada periode ini dan hasil keputusan finalnya."
            empty={analytics.funnel.cohort === 0}
          >
            <div className="space-y-4">
              <ul className="space-y-2">
                {analytics.funnel.stages.map((stage) => (
                  <li key={stage.stage} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-xs text-ink-muted">
                      {stage.label}
                    </span>
                    <div className="h-2.5 flex-1 rounded-full bg-surface-muted">
                      <div
                        className="h-2.5 rounded-full"
                        style={{
                          width: barWidth(stage.total, funnelMax),
                          backgroundColor: "var(--chart-1)",
                        }}
                        role="img"
                        aria-label={`${stage.label}: ${stage.total}`}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-sm font-semibold text-foreground tabular">
                      {formatNumberId(stage.total)}
                    </span>
                  </li>
                ))}
              </ul>
              <div>
                <p className="text-xs font-semibold text-ink-muted">Hasil</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {analytics.funnel.outcomes.map((outcome) => (
                    <ChartLegendChip
                      key={outcome.stage}
                      color="var(--chart-3)"
                      label={outcome.label}
                      value={formatNumberId(outcome.total)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </ChartFrame>

          <ChartFrame
            title="Kontribusi sumber"
            description="Konten masuk per kategori organisasi pada periode ini."
            empty={analytics.sources.length === 0}
          >
            <div
              className="overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Tabel kontribusi sumber, dapat digulir"
            >
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-ink-muted">
                    <th scope="col" className="py-2 font-semibold">
                      Sumber
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Masuk
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Menunggu
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Disetujui
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Organisasi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.sources.map((row) => (
                    <tr key={row.source} className="border-b border-border/70">
                      <td className="py-2 font-medium text-foreground">
                        {row.label}
                      </td>
                      <td className="py-2 text-right tabular">
                        {formatNumberId(row.submitted)}
                      </td>
                      <td className="py-2 text-right tabular">
                        {formatNumberId(row.pending)}
                      </td>
                      <td className="py-2 text-right tabular">
                        {formatNumberId(row.approved)}
                      </td>
                      <td className="py-2 text-right tabular">
                        {formatNumberId(row.organizations)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartFrame>

          <ChartFrame
            title="SLA per jenis organisasi"
            description="Waktu dari pengiriman ke approval final untuk konten yang disetujui pada periode ini."
            empty={analytics.sla.length === 0}
          >
            <div
              className="overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Tabel SLA per jenis organisasi, dapat digulir"
            >
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-ink-muted">
                    <th scope="col" className="py-2 font-semibold">
                      Jenis organisasi
                    </th>
                    <th scope="col" className="py-2 font-semibold">
                      Konten
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Sampel
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Median hari
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Rata-rata
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.sla.map((row) => (
                    <tr
                      key={`${row.organizationType}-${row.contentType}`}
                      className="border-b border-border/70"
                    >
                      <td className="py-2 font-medium text-foreground">
                        {row.organizationType}
                      </td>
                      <td className="py-2 text-ink-muted">{row.contentType}</td>
                      <td className="py-2 text-right tabular">
                        {formatNumberId(row.samples)}
                      </td>
                      <td className="py-2 text-right tabular">
                        {row.medianDays === null
                          ? "—"
                          : formatNumberId(row.medianDays)}
                      </td>
                      <td className="py-2 text-right tabular">
                        {row.averageDays === null
                          ? "—"
                          : formatNumberId(row.averageDays)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartFrame>
        </div>
      )}
    </div>
  );
}
