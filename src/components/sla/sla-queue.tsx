import Link from "next/link";
import { CalendarClock, Inbox, Search, ShieldCheck } from "lucide-react";

import { ContentTypeBadge } from "@/components/content/content-type-badge";
import { StatusBadge } from "@/components/content/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { PLATFORM_LABEL } from "@/lib/content-status";
import { formatDateId, formatDateTimeId, formatNumberId } from "@/lib/dates";
import type { ReviewQueueResult } from "@/lib/review";
import {
  calculateSlaClock,
  slaPolicyLabel,
  type SlaPolicySummary,
} from "@/lib/sla";

const TABS = [
  { key: "ALL", label: "Semua" },
  { key: "SUBMITTED", label: "Terkirim" },
  { key: "RESUBMITTED", label: "Dikirim ulang" },
  { key: "IN_REVIEW", label: "Ditinjau" },
] as const;

export type SlaTabKey = (typeof TABS)[number]["key"];

function queueHref(
  basePath: string,
  next: { status?: SlaTabKey; q?: string; page?: number },
  current: { status: SlaTabKey; q?: string },
): string {
  const params = new URLSearchParams();
  const status = next.status ?? current.status;
  if (status !== "ALL") params.set("status", status);
  const q = next.q ?? current.q;
  if (q) params.set("q", q);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const serialized = params.toString();
  return `${basePath}${serialized ? `?${serialized}` : ""}`;
}

export function SlaQueue({
  queue,
  policy,
  detailBase,
  canDecide,
  basePath,
  search,
  status,
  scopeLabel,
  readOnlyNote,
}: {
  queue: ReviewQueueResult;
  policy: SlaPolicySummary | null;
  detailBase: string;
  canDecide: boolean;
  basePath: string;
  search?: string;
  status: SlaTabKey;
  scopeLabel: string;
  readOnlyNote?: string;
}) {
  const now = queue.generatedAt;
  const overdue = queue.items.filter((item) => {
    const clock = calculateSlaClock({
      firstSubmittedAt: item.firstSubmittedAt,
      submittedAt: item.submittedAt,
      policy,
      now,
    });
    return (clock.overdueDays ?? 0) > 0;
  }).length;

  return (
    <div className="space-y-6">
      <section
        aria-label="Kebijakan SLA"
        className="rounded-xl border border-border bg-surface p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 size-5 shrink-0 text-brand-teal-700"
              aria-hidden
            />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Kebijakan SLA aktif
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {slaPolicyLabel(policy)}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {policy
                  ? `Titik awal: ${policy.startsAt === "FIRST_SUBMISSION" ? "pengiriman pertama" : "pengiriman terakhir"}${
                      policy.pausesOnRevision
                        ? " · dijeda saat revisi"
                        : " · tidak dijeda saat revisi"
                    }. SLA berakhir hanya pada approval final Admin Cabang.`
                  : "Aging tetap dihitung dari pengiriman pertama. Tenggat dan keterlambatan tidak diisi sebelum Master Admin menetapkan kebijakan."}
              </p>
            </div>
          </div>
          {readOnlyNote ? (
            <p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-ink-muted">
              {readOnlyNote}
            </p>
          ) : null}
        </div>
      </section>

      <section
        aria-label="Ringkasan antrean"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Menunggu keputusan"
          value={formatNumberId(queue.counts.ALL)}
          hint={`Terkirim, dikirim ulang, ditinjau · ${scopeLabel}`}
          icon={Inbox}
          tone="amber"
        />
        <StatCard
          label="Dikirim ulang"
          value={formatNumberId(queue.counts.RESUBMITTED)}
          hint="Perlu verifikasi ulang"
          icon={CalendarClock}
          tone="blue"
        />
        <StatCard
          label="Sedang ditinjau"
          value={formatNumberId(queue.counts.IN_REVIEW)}
          hint="Sudah dimulai reviewer"
          icon={Search}
          tone="teal"
        />
        <StatCard
          label="Melewati tenggat"
          value={policy ? formatNumberId(overdue) : "N/A"}
          hint={
            policy
              ? "Berdasarkan kebijakan aktif"
              : "Kebijakan belum ditetapkan"
          }
          icon={ShieldCheck}
          tone={overdue > 0 ? "red" : "teal"}
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Filter status antrean"
          className="flex flex-wrap gap-1.5"
        >
          {TABS.map((tab) => {
            const active = status === tab.key;
            return (
              <Link
                key={tab.key}
                href={queueHref(
                  basePath,
                  { status: tab.key, page: 1 },
                  { status, q: search },
                )}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-full bg-brand-blue-700 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                }
              >
                {tab.label} ({formatNumberId(queue.counts[tab.key])})
              </Link>
            );
          })}
        </nav>

        <form action={basePath} method="get" className="flex gap-2">
          {status !== "ALL" ? (
            <input type="hidden" name="status" value={status} />
          ) : null}
          <label>
            <span className="sr-only">Cari konten</span>
            <input
              type="search"
              name="q"
              defaultValue={search ?? ""}
              placeholder="Cari kode, judul, instansi"
              className="h-10 w-64 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <Button type="submit" variant="outline" className="h-10">
            Cari
          </Button>
        </form>
      </div>

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Antrean SLA
          </h2>
          <p className="text-xs text-ink-muted">
            {formatNumberId(queue.total)} konten · halaman {queue.page} dari{" "}
            {Math.max(queue.pageCount, 1)} · diperbarui{" "}
            {formatDateTimeId(queue.generatedAt)} WIB
          </p>
        </div>

        {queue.items.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <Inbox className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">
              Tidak ada konten menunggu
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Antrean akan terisi saat instansi mengirim konten.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] border-collapse text-sm">
              <caption className="sr-only">Antrean konten menurut SLA</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    Konten
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Jenis
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Instansi
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Pengiriman pertama
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Usia
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Revisi
                  </th>
                  <th scope="col" className="px-4 py-3">
                    SLA
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody>
                {queue.items.map((item) => {
                  const clock = calculateSlaClock({
                    firstSubmittedAt: item.firstSubmittedAt,
                    submittedAt: item.submittedAt,
                    policy,
                    now,
                  });
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-border/70 align-top last:border-0"
                    >
                      <td className="px-4 py-4">
                        <Link
                          href={`${detailBase}/${item.id}`}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {item.title ?? "(tanpa judul)"}
                        </Link>
                        <p className="text-xs text-ink-muted">
                          {item.referenceCode} · v{item.version} ·{" "}
                          {PLATFORM_LABEL[item.platform] ?? item.platform}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <ContentTypeBadge contentType={item.contentType} />
                      </td>
                      <td className="px-4 py-4 text-ink-muted">
                        <span className="block text-foreground">
                          {item.stakeholderName}
                        </span>
                        <span className="text-xs">{item.themeName}</span>
                      </td>
                      <td className="px-4 py-4 text-ink-muted">
                        {item.firstSubmittedAt
                          ? formatDateId(item.firstSubmittedAt)
                          : "—"}
                      </td>
                      <td className="px-4 py-4 font-medium text-foreground">
                        {item.agingDays} hari
                      </td>
                      <td className="px-4 py-4 text-ink-muted">
                        {item.resubmissionCount > 0
                          ? `${item.resubmissionCount}× kirim ulang`
                          : "—"}
                      </td>
                      <td className="px-4 py-4">
                        {clock.deadline ? (
                          <span
                            className={
                              (clock.overdueDays ?? 0) > 0
                                ? "font-medium text-status-rejected"
                                : "text-ink-muted"
                            }
                          >
                            {formatDateId(clock.deadline)}
                            <span className="block text-xs">
                              {(clock.overdueDays ?? 0) > 0
                                ? `Lewat ${clock.overdueDays} hari`
                                : "Dalam tenggat"}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-ink-muted">
                            Belum ditetapkan
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`${detailBase}/${item.id}`}>
                            {canDecide ? "Tinjau" : "Lihat"}
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

        {queue.pageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-ink-muted">
              Menampilkan{" "}
              {formatNumberId((queue.page - 1) * queue.pageSize + 1)}–
              {formatNumberId(
                Math.min(queue.page * queue.pageSize, queue.total),
              )}{" "}
              dari {formatNumberId(queue.total)}
            </p>
            <div className="flex gap-2">
              {queue.page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={queueHref(
                      basePath,
                      { page: queue.page - 1 },
                      { status, q: search },
                    )}
                  >
                    Sebelumnya
                  </Link>
                </Button>
              ) : null}
              {queue.page < queue.pageCount ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={queueHref(
                      basePath,
                      { page: queue.page + 1 },
                      { status, q: search },
                    )}
                  >
                    Berikutnya
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
