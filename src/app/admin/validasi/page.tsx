import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Hourglass,
  Inbox,
  Search,
} from "lucide-react";

import { StatusBadge } from "@/components/content/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { PLATFORM_LABEL } from "@/lib/content-status";
import {
  listReviewQueue,
  listReviewQueueOptions,
} from "@/lib/review";
import { requireRole } from "@/lib/session";
import { isSubTheme, type SubTheme } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Validasi konten",
};

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TABS = [
  { key: "ALL", label: "Semua" },
  { key: "SUBMITTED", label: "Terkirim" },
  { key: "RESUBMITTED", label: "Dikirim ulang" },
  { key: "IN_REVIEW", label: "Ditinjau" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseStatus(value: string | undefined): TabKey {
  return value === "SUBMITTED" ||
    value === "RESUBMITTED" ||
    value === "IN_REVIEW"
    ? value
    : "ALL";
}

function parseUuid(value: string | undefined): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

function parseSubTheme(value: string | undefined): SubTheme | undefined {
  return isSubTheme(value) ? value : undefined;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

function agingBadge(days: number) {
  if (days >= 7) {
    return {
      className: "border-status-rejected/30 bg-status-rejected/10 text-status-rejected",
      label: `${days} hari · prioritas`,
    };
  }
  if (days >= 3) {
    return {
      className: "border-status-revision/30 bg-status-revision/10 text-status-revision",
      label: `${days} hari`,
    };
  }
  return {
    className: "border-border bg-surface-muted text-ink-muted",
    label: days <= 0 ? "Hari ini" : `${days} hari`,
  };
}

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;

  const status = parseStatus(firstParam(params.status));
  const stakeholderId = parseUuid(firstParam(params.stakeholderId));
  const subTheme = parseSubTheme(firstParam(params.subTheme));
  const search = firstParam(params.q)?.trim().slice(0, 120) || undefined;
  const page = Math.max(Number(firstParam(params.page) ?? 1) || 1, 1);

  const [queue, options] = await Promise.all([
    listReviewQueue(admin, {
      status,
      stakeholderId,
      subTheme,
      search,
      page,
      pageSize: 15,
    }),
    listReviewQueueOptions(admin),
  ]);

  const oldestDays = queue.oldestSubmittedAt
    ? Math.max(
        0,
        Math.floor(
          (queue.generatedAt.getTime() - queue.oldestSubmittedAt.getTime()) /
            86_400_000,
        ),
      )
    : 0;

  const preserved = {
    q: search,
    stakeholderId,
    subTheme,
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Antrean validasi
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Tinjau konten yang dikirim stakeholder. Antrean diurutkan dari
            pengiriman paling lama. Hanya konten yang disetujui yang dihitung
            dalam capaian.
          </p>
        </div>
        <p className="text-xs text-ink-muted">
          Diperbarui {formatDateTimeId(queue.generatedAt)} WIB
        </p>
      </header>

      <section
        aria-label="Ringkasan antrean"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Menunggu validasi"
          value={formatNumberId(queue.counts.ALL)}
          hint="Terkirim dan sedang ditinjau"
          icon={ClipboardCheck}
          tone="amber"
        />
        <StatCard
          label="Belum ditinjau"
          value={formatNumberId(queue.counts.SUBMITTED)}
          hint="Status Terkirim"
          icon={Inbox}
          tone="blue"
        />
        <StatCard
          label="Sedang ditinjau"
          value={formatNumberId(queue.counts.IN_REVIEW)}
          hint="Status Ditinjau"
          icon={CheckCircle2}
          tone="teal"
        />
        <StatCard
          label="Antrean tertua"
          value={oldestDays === 0 ? "Hari ini" : `${oldestDays} hari`}
          hint={
            queue.oldestSubmittedAt
              ? `Dikirim ${formatDateTimeId(queue.oldestSubmittedAt)}`
              : "Antrean kosong"
          }
          icon={queue.counts.ALL === 0 ? CalendarClock : Hourglass}
          tone={oldestDays >= 7 ? "red" : oldestDays >= 3 ? "amber" : "neutral"}
        />
      </section>

      <section
        aria-labelledby="queue-list-title"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="queue-list-title" className="text-base font-semibold text-foreground">
                Daftar antrean
              </h2>
              <p className="text-xs text-ink-muted">
                {formatNumberId(queue.total)} konten sesuai filter aktif.
              </p>
            </div>
            <nav aria-label="Filter status antrean" className="flex flex-wrap gap-1.5">
              {TABS.map((tab) => {
                const active = status === tab.key;
                return (
                  <Link
                    key={tab.key}
                    href={`/admin/validasi${buildQuery({ ...preserved, status: tab.key === "ALL" ? undefined : tab.key })}`}
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
          </div>

          <form
            action="/admin/validasi"
            method="get"
            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_220px_auto]"
          >
            {status !== "ALL" ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            <label className="relative">
              <span className="sr-only">Cari konten</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <input
                type="search"
                name="q"
                defaultValue={search ?? ""}
                placeholder="Cari referensi, judul, atau stakeholder"
                className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label>
              <span className="sr-only">Filter stakeholder</span>
              <select
                name="stakeholderId"
                defaultValue={stakeholderId ?? ""}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Semua stakeholder</option>
                {options.stakeholders.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter tema</span>
              <select
                name="subTheme"
                defaultValue={subTheme ?? ""}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Semua tema</option>
                {options.themes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="outline" className="h-10">
                Terapkan
              </Button>
              <Button asChild variant="ghost" className="h-10">
                <Link
                  href={`/admin/validasi${buildQuery({ status: status === "ALL" ? undefined : status })}`}
                >
                  Atur ulang
                </Link>
              </Button>
            </div>
          </form>
        </div>

        {queue.items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Inbox className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">
              Tidak ada konten pada filter ini
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Antrean akan muncul saat stakeholder mengirim konten untuk validasi.
            </p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <caption className="sr-only">
                Konten yang menunggu validasi admin, diurutkan dari pengiriman
                paling lama
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-5 py-3">
                    Konten
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Stakeholder
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Tema / platform
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Dikirim
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Usia
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {queue.items.map((item) => {
                  const aging = agingBadge(item.agingDays);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-border/70 last:border-0 align-top"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/validasi/${item.id}`}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {item.title ?? "(tanpa judul)"}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {item.referenceCode} · v{item.version}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-ink-muted">
                        {item.stakeholderName}
                      </td>
                      <td className="px-5 py-4 text-ink-muted">
                        <span className="block text-foreground">{item.themeName}</span>
                        <span className="text-xs">
                          {PLATFORM_LABEL[item.platform] ?? item.platform}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-ink-muted">
                        {formatDateTimeId(item.submittedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${aging.className}`}
                        >
                          {aging.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button asChild size="sm" variant="outline" className="h-9">
                          <Link href={`/admin/validasi/${item.id}`}>Tinjau</Link>
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
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 sm:flex-row">
            <p className="text-xs text-ink-muted">
              Halaman {queue.page} dari {queue.pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9"
                aria-disabled={queue.page <= 1}
              >
                <Link
                  href={`/admin/validasi${buildQuery({
                    ...preserved,
                    status: status === "ALL" ? undefined : status,
                    page: String(Math.max(1, queue.page - 1)),
                  })}`}
                >
                  Sebelumnya
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9"
                aria-disabled={queue.page >= queue.pageCount}
              >
                <Link
                  href={`/admin/validasi${buildQuery({
                    ...preserved,
                    status: status === "ALL" ? undefined : status,
                    page: String(Math.min(queue.pageCount, queue.page + 1)),
                  })}`}
                >
                  Berikutnya
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
