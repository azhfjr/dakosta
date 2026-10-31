import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

import { ContentTypeBadge } from "@/components/content/content-type-badge";
import { StatusBadge } from "@/components/content/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateId, formatDateTimeId, formatNumberId } from "@/lib/dates";
import { PLATFORM_LABEL, STATUS_LABEL, type ContentStatus } from "@/lib/content-status";
import { getKpiFilterOptions } from "@/lib/kpi/sql";
import {
  getSubmissionStatusCounts,
  listSubmissions,
} from "@/lib/submissions";
import { requireRole } from "@/lib/session";
import { isSubTheme, type SubTheme } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Semua konten",
};

export const dynamic = "force-dynamic";

const TABS: Array<{ key: ContentStatus | "ALL"; label: string }> = [
  { key: "ALL", label: "Semua" },
  { key: "APPROVED", label: STATUS_LABEL.APPROVED },
  { key: "SUBMITTED", label: STATUS_LABEL.SUBMITTED },
  { key: "IN_REVIEW", label: STATUS_LABEL.IN_REVIEW },
  { key: "REVISION_REQUIRED", label: STATUS_LABEL.REVISION_REQUIRED },
  { key: "REJECTED", label: STATUS_LABEL.REJECTED },
  { key: "DRAFT", label: STATUS_LABEL.DRAFT },
  { key: "REVOKED", label: STATUS_LABEL.REVOKED },
  { key: "ARCHIVED", label: STATUS_LABEL.ARCHIVED },
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseStatus(value: string | string[] | undefined): ContentStatus | "ALL" {
  const raw = Array.isArray(value) ? value[0] : value;
  const found = TABS.find((tab) => tab.key === raw);
  return found ? found.key : "ALL";
}

function parseUuid(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && UUID_PATTERN.test(raw) ? raw : undefined;
}

function parseSubTheme(value: string | string[] | undefined): SubTheme | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return isSubTheme(raw) ? raw : undefined;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;
  const status = parseStatus(params.status);
  const stakeholderId = parseUuid(params.stakeholderId);
  const subTheme = parseSubTheme(params.subTheme);

  const [counts, items, options] = await Promise.all([
    getSubmissionStatusCounts(admin),
    listSubmissions(admin, {
      status: status === "ALL" ? undefined : status,
      stakeholderId,
      subTheme,
      limit: 100,
    }),
    getKpiFilterOptions(admin),
  ]);

  const preserved = {
    stakeholderId,
    subTheme,
  };
  const exportHref = `/api/v1/exports/submissions${buildQuery({
    ...preserved,
    status: status === "ALL" ? undefined : status,
  })}`;

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Semua konten
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Arsip seluruh konten lintas stakeholder beserta status dan versi
            terakhirnya. Hanya status Disetujui yang dihitung dalam capaian.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button asChild variant="outline" className="h-10">
            <a href={exportHref}>Ekspor CSV</a>
          </Button>
          <p className="text-xs text-ink-muted">
            {formatNumberId(total)} konten tersimpan
          </p>
        </div>
      </header>

      <nav aria-label="Filter status konten" className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const active = status === tab.key;
          const value = tab.key === "ALL" ? total : counts[tab.key];
          return (
            <Link
              key={tab.key}
              href={`/admin/konten${buildQuery({
                ...preserved,
                status: tab.key === "ALL" ? undefined : tab.key,
              })}`}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-full bg-brand-blue-700 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              }
            >
              {tab.label} ({formatNumberId(value)})
            </Link>
          );
        })}
      </nav>

      <form
        action="/admin/konten"
        method="get"
        className="grid gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:p-5"
      >
        {status !== "ALL" ? (
          <input type="hidden" name="status" value={status} />
        ) : null}
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
              href={`/admin/konten${buildQuery({
                status: status === "ALL" ? undefined : status,
              })}`}
            >
              Atur ulang
            </Link>
          </Button>
        </div>
      </form>

      <section
        aria-labelledby="konten-daftar"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
          <h2 id="konten-daftar" className="text-base font-semibold text-foreground">
            {status === "ALL" ? "Konten terbaru" : `Konten ${STATUS_LABEL[status]}`}
          </h2>
          <p className="text-xs text-ink-muted">
            Maksimal 100 konten, diurutkan dari pembaruan terakhir.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <FileText className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">
              Belum ada konten pada status ini
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Konten akan tampil setelah stakeholder menyimpan atau mengirim laporan.
            </p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[64rem] border-collapse text-sm">
              <caption className="sr-only">
                Daftar konten dengan status, stakeholder, tema, dan tanggal
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-5 py-3">Konten</th>
                  <th scope="col" className="px-5 py-3">Jenis konten</th>
                  <th scope="col" className="px-5 py-3">Stakeholder</th>
                  <th scope="col" className="px-5 py-3">Tema / platform</th>
                  <th scope="col" className="px-5 py-3">Tanggal konten</th>
                  <th scope="col" className="px-5 py-3">Dikirim</th>
                  <th scope="col" className="px-5 py-3">Disetujui</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
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
                        {item.referenceCode} · v{item.version}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <ContentTypeBadge contentType={item.contentType} />
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {item.stakeholderName}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      <span className="block text-foreground">{item.themeName}</span>
                      <span className="text-xs">
                        {PLATFORM_LABEL[item.platform] ?? item.platform}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {formatDateId(item.dateCreated)}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {formatDateTimeId(item.submittedAt)}
                    </td>
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
    </div>
  );
}
