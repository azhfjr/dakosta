import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Inbox, Search } from "lucide-react";

import { ContentTypeBadge } from "@/components/content/content-type-badge";
import { StatusBadge } from "@/components/content/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { PLATFORM_LABEL } from "@/lib/content-status";
import { listReviewQueue } from "@/lib/review";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Antrean review cabang",
};

export const dynamic = "force-dynamic";

const TABS = [
  { key: "ALL", label: "Semua" },
  { key: "SUBMITTED", label: "Terkirim" },
  { key: "RESUBMITTED", label: "Dikirim ulang" },
  { key: "IN_REVIEW", label: "Ditinjau" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): TabKey {
  return value === "SUBMITTED" || value === "RESUBMITTED" || value === "IN_REVIEW"
    ? value
    : "ALL";
}

export default async function BranchReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("BRANCH_ADMIN");
  const params = await searchParams;
  const status = parseStatus(firstParam(params.status));
  const search = firstParam(params.q)?.trim().slice(0, 120) || undefined;
  const page = Math.max(Number(firstParam(params.page) ?? 1) || 1, 1);

  const queue = await listReviewQueue(user, {
    status,
    search,
    page,
    pageSize: 15,
  });

  function href(next: { status?: TabKey; q?: string; page?: number }): string {
    const searchParams = new URLSearchParams();
    const nextStatus = next.status ?? status;
    if (nextStatus !== "ALL") searchParams.set("status", nextStatus);
    const nextSearch = next.q ?? search;
    if (nextSearch) searchParams.set("q", nextSearch);
    if (next.page && next.page > 1) searchParams.set("page", String(next.page));
    const serialized = searchParams.toString();
    return `/cabang/review${serialized ? `?${serialized}` : ""}`;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Antrean review cabang
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Konten dari organisasi di {user.scopeLabel} yang menunggu keputusan.
          Keputusan hanya berlaku untuk cabang Anda.
        </p>
      </header>

      <section aria-label="Ringkasan antrean" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Menunggu keputusan"
          value={formatNumberId(queue.counts.ALL)}
          hint="Terkirim, dikirim ulang, ditinjau"
          icon={Inbox}
          tone="amber"
        />
        <StatCard
          label="Dikirim ulang"
          value={formatNumberId(queue.counts.RESUBMITTED)}
          hint="Butuh verifikasi ulang"
          icon={CalendarClock}
          tone="blue"
        />
        <StatCard
          label="Sudah ditinjau"
          value={formatNumberId(queue.counts.IN_REVIEW)}
          hint="Sedang dalam proses"
          icon={Search}
          tone="teal"
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter status antrean" className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => {
            const active = status === tab.key;
            return (
              <Link
                key={tab.key}
                href={href({ status: tab.key, page: 1 })}
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

        <form action="/cabang/review" method="get" className="flex gap-2">
          {status !== "ALL" ? (
            <input type="hidden" name="status" value={status} />
          ) : null}
          <label>
            <span className="sr-only">Cari konten</span>
            <input
              type="search"
              name="q"
              defaultValue={search ?? ""}
              placeholder="Cari kode, judul, organisasi"
              className="h-10 w-64 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <Button type="submit" variant="outline" className="h-10">
            Cari
          </Button>
        </form>
      </div>

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Daftar antrean</h2>
          <p className="text-xs text-ink-muted">
            {formatNumberId(queue.total)} konten · halaman {queue.page} dari{" "}
            {Math.max(queue.pageCount, 1)}
          </p>
        </div>

        {queue.items.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <Inbox className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">
              Tidak ada konten menunggu
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Antrean akan terisi saat organisasi mengirim konten.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <caption className="sr-only">Antrean konten untuk direview</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    Konten
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Jenis konten
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Organisasi
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Tema / platform
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Dikirim
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Usia
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
                {queue.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/70 align-top last:border-0"
                  >
                    <td className="px-4 py-4">
                      <Link
                        href={`/cabang/review/${item.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {item.title ?? "(tanpa judul)"}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {item.referenceCode} · v{item.version}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <ContentTypeBadge contentType={item.contentType} />
                    </td>
                    <td className="px-4 py-4 text-ink-muted">
                      {item.stakeholderName}
                    </td>
                    <td className="px-4 py-4 text-ink-muted">
                      <span className="block text-foreground">{item.themeName}</span>
                      <span className="text-xs">
                        {PLATFORM_LABEL[item.platform] ?? item.platform}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-ink-muted">
                      {formatDateTimeId(item.submittedAt)}
                    </td>
                    <td className="px-4 py-4 text-ink-muted">
                      {item.agingDays <= 0 ? "Hari ini" : `${item.agingDays} hari`}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button asChild size="sm" className="h-9">
                        <Link href={`/cabang/review/${item.id}`}>Tinjau</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {queue.pageCount > 1 ? (
        <nav aria-label="Navigasi halaman" className="flex items-center justify-between">
          <Button asChild variant="outline" className="h-10" aria-disabled={queue.page <= 1}>
            <Link href={href({ page: Math.max(queue.page - 1, 1) })}>Sebelumnya</Link>
          </Button>
          <p className="text-xs text-ink-muted">
            Halaman {queue.page} dari {queue.pageCount}
          </p>
          <Button
            asChild
            variant="outline"
            className="h-10"
            aria-disabled={queue.page >= queue.pageCount}
          >
            <Link href={href({ page: Math.min(queue.page + 1, queue.pageCount) })}>
              Berikutnya
            </Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
