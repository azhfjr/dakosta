import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Hourglass,
  Inbox,
} from "lucide-react";

import { ContentTypeBadge } from "@/components/content/content-type-badge";
import { StatusBadge } from "@/components/content/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { PLATFORM_LABEL } from "@/lib/content-status";
import { getFilterOptions } from "@/lib/filters/options";
import {
  buildFilterHref,
  filterResetHref,
  firstParam,
  parseFilterSubTheme,
  parseFilterUuid,
  type FilterParams,
} from "@/lib/filters/query";
import { listReviewQueue } from "@/lib/review";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Validasi konten",
};

export const dynamic = "force-dynamic";

const TABS = [
  { key: "ALL", label: "Semua" },
  { key: "SUBMITTED", label: "Terkirim" },
  { key: "RESUBMITTED", label: "Dikirim ulang" },
  { key: "IN_REVIEW", label: "Ditinjau" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function parseStatus(value: string | undefined): TabKey {
  return value === "SUBMITTED" ||
    value === "RESUBMITTED" ||
    value === "IN_REVIEW"
    ? value
    : "ALL";
}

function agingBadge(days: number) {
  if (days >= 7) {
    return {
      className:
        "border-status-rejected/30 bg-status-rejected/10 text-status-rejected",
      label: `${days} hari · prioritas`,
    };
  }
  if (days >= 3) {
    return {
      className:
        "border-status-revision/30 bg-status-revision/10 text-status-revision",
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

  const status = parseStatus(firstParam(params, "status"));
  const stakeholderId =
    parseFilterUuid(firstParam(params, "stakeholderId")) ?? undefined;
  const subTheme =
    parseFilterSubTheme(firstParam(params, "subTheme")) ?? undefined;
  const search = firstParam(params, "q")?.slice(0, 120) || undefined;
  const page = Math.max(Number(firstParam(params, "page") ?? 1) || 1, 1);

  const [queue, options] = await Promise.all([
    listReviewQueue(admin, {
      status,
      stakeholderId,
      subTheme,
      search,
      page,
      pageSize: 15,
    }),
    getFilterOptions(admin),
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

  const currentFilters: FilterParams = {
    status,
    stakeholderId,
    subTheme,
    q: search,
  };

  const filterFields: FilterField[] = [
    {
      kind: "select",
      name: "status",
      label: "Status antrean",
      value: status,
      options: TABS.filter((tab) => tab.key !== "ALL").map((tab) => ({
        value: tab.key,
        label: `${tab.label} (${formatNumberId(queue.counts[tab.key])})`,
      })),
      allLabel: `Semua (${formatNumberId(queue.counts.ALL)})`,
    },
    {
      kind: "select",
      name: "stakeholderId",
      label: "Stakeholder",
      value: stakeholderId ?? "",
      options: options.stakeholders,
      allLabel: "Semua stakeholder",
    },
    {
      kind: "select",
      name: "subTheme",
      label: "Sub-tema",
      value: subTheme ?? "",
      options: options.subThemes,
      allLabel: "Semua sub-tema",
    },
    {
      kind: "search",
      name: "q",
      label: "Cari konten",
      value: search ?? "",
      placeholder: "Referensi, judul, atau stakeholder",
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Antrean validasi"
        description="Tinjau konten yang dikirim stakeholder. Antrean diurutkan dari pengiriman paling lama. Hanya konten yang disetujui yang dihitung dalam capaian."
        meta={`Diperbarui ${formatDateTimeId(queue.generatedAt)} WIB`}
      />

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

      <FilterBar
        action="/admin/validasi"
        label="Filter antrean"
        idPrefix="validasi"
        resetHref={filterResetHref("/admin/validasi")}
        fields={filterFields}
        summary="Antrean diurutkan dari pengiriman paling lama. Hanya konten yang disetujui yang dihitung dalam capaian."
      />

      <section
        aria-labelledby="queue-list-title"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="queue-list-title"
            className="text-base font-semibold text-foreground"
          >
            Daftar antrean
          </h2>
          <p className="text-xs text-ink-muted">
            {formatNumberId(queue.total)} konten sesuai filter aktif.
          </p>
        </div>

        {queue.items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Inbox className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">
              Tidak ada konten pada filter ini
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Antrean akan muncul saat stakeholder mengirim konten untuk
              validasi.
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
                    Jenis konten
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
                      <td className="px-5 py-4">
                        <ContentTypeBadge contentType={item.contentType} />
                      </td>
                      <td className="px-5 py-4 text-ink-muted">
                        {item.stakeholderName}
                      </td>
                      <td className="px-5 py-4 text-ink-muted">
                        <span className="block text-foreground">
                          {item.themeName}
                        </span>
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
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-9"
                        >
                          <Link href={`/admin/validasi/${item.id}`}>
                            Tinjau
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
                  href={buildFilterHref("/admin/validasi", currentFilters, {
                    page: Math.max(1, queue.page - 1),
                  })}
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
                  href={buildFilterHref("/admin/validasi", currentFilters, {
                    page: Math.min(queue.pageCount, queue.page + 1),
                  })}
                >
                  Berikutnya
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </PageContainer>
  );
}
