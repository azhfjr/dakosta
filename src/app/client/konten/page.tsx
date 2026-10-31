import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, PlusCircle } from "lucide-react";

import { ContentTypeBadge } from "@/components/content/content-type-badge";
import { StatusBadge } from "@/components/content/status-badge";
import { Button } from "@/components/ui/button";
import {
  CONTENT_STATUSES,
  PLATFORM_LABEL,
  STATUS_LABEL,
  type ContentStatus,
} from "@/lib/content-status";
import { formatDateId } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { listSubmissions } from "@/lib/submissions";

export const metadata: Metadata = {
  title: "Konten saya",
};

export const dynamic = "force-dynamic";

function parseStatus(value: string | string[] | undefined): ContentStatus | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  return (CONTENT_STATUSES as readonly string[]).includes(raw)
    ? (raw as ContentStatus)
    : undefined;
}

export default async function ClientContentListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("CLIENT");
  const params = await searchParams;
  const status = parseStatus(params.status);
  const submissions = await listSubmissions(user, { status, limit: 100 });
  const exportHref = `/api/v1/exports/submissions${status ? `?status=${status}` : ""}`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Konten saya
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Seluruh konten stakeholder Anda, termasuk draf dan riwayat keputusan.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-11">
              <a href={exportHref}>
                <Download className="size-4" aria-hidden />
                Ekspor CSV
              </a>
            </Button>
            <Button asChild className="h-11">
              <Link href="/client/lapor">
                <PlusCircle className="size-4" aria-hidden />
                Lapor konten
              </Link>
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            Ekspor mengikuti filter status aktif.
          </p>
        </div>
      </header>

      <nav aria-label="Filter status" className="flex flex-wrap gap-2">
        <Button
          asChild
          size="sm"
          variant={status ? "outline" : "secondary"}
          className="h-9"
        >
          <Link href="/client/konten">Semua</Link>
        </Button>
        {CONTENT_STATUSES.map((item) => (
          <Button
            key={item}
            asChild
            size="sm"
            variant={status === item ? "secondary" : "outline"}
            className="h-9"
          >
            <Link href={`/client/konten?status=${item}`}>{STATUS_LABEL[item]}</Link>
          </Button>
        ))}
      </nav>

      <section
        aria-labelledby="daftar-konten-title"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <h2 id="daftar-konten-title" className="sr-only">
          Daftar konten
        </h2>

        {submissions.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <FileText className="mx-auto size-9 text-ink-muted" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">
              Belum ada konten pada filter ini
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Mulai dengan melaporkan konten pertama Anda.
            </p>
            <Button asChild className="mt-4 h-11">
              <Link href="/client/lapor">Lapor konten</Link>
            </Button>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <caption className="sr-only">Daftar konten Anda beserta statusnya</caption>
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
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Diperbarui
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((item) => (
                  <tr key={item.id} className="border-b border-border/70 last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/client/konten/${item.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
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
                    <td className="px-5 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {formatDateId(item.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs leading-relaxed text-ink-muted">
        Hanya konten berstatus disetujui yang dihitung dalam capaian. Draf, konten yang
        ditolak, perlu revisi, dicabut, atau diarsipkan tidak menambah angka.
      </p>
    </div>
  );
}
