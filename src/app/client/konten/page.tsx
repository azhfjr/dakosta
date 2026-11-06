import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, PlusCircle } from "lucide-react";

import { ContentTypeBadge } from "@/components/content/content-type-badge";
import { StatusBadge } from "@/components/content/status-badge";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { PLATFORM_LABEL, STATUS_LABEL } from "@/lib/content-status";
import { formatDateId } from "@/lib/dates";
import { getFilterOptions } from "@/lib/filters/options";
import {
  firstParam,
  parseFilterSort,
  parseFilterStatus,
  parseFilterSubTheme,
} from "@/lib/filters/query";
import { requireRole } from "@/lib/session";
import { listSubmissions } from "@/lib/submissions";

export const metadata: Metadata = {
  title: "Konten saya",
};

export const dynamic = "force-dynamic";

const SORTS = ["updated", "created", "approved", "title"] as const;

const SORT_LABELS: Record<(typeof SORTS)[number], string> = {
  updated: "Terbaru diperbarui",
  created: "Terbaru dibuat",
  approved: "Terbaru disetujui",
  title: "Judul A–Z",
};

export default async function ClientContentListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("CLIENT");
  const params = await searchParams;
  const status = parseFilterStatus(firstParam(params, "status"));
  const subTheme = parseFilterSubTheme(firstParam(params, "subTheme"));
  const sort = parseFilterSort(firstParam(params, "sort"), SORTS, "updated");

  const [submissions, options] = await Promise.all([
    listSubmissions(user, {
      status: status === "ALL" ? undefined : status,
      subTheme: subTheme ?? undefined,
      sort,
      limit: 100,
    }),
    getFilterOptions(user),
  ]);

  const search = new URLSearchParams();
  if (status !== "ALL") search.set("status", status);
  if (subTheme) search.set("subTheme", subTheme);
  const serialized = search.toString();
  const exportHref = `/api/v1/exports/submissions${serialized ? `?${serialized}` : ""}`;

  const filterFields: FilterField[] = [
    {
      kind: "select",
      name: "status",
      label: "Status",
      value: status === "ALL" ? "" : status,
      options: options.statuses,
      allLabel: "Semua status",
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
      kind: "select",
      name: "sort",
      label: "Urutkan",
      value: sort,
      options: SORTS.map((value) => ({ value, label: SORT_LABELS[value] })),
      allLabel: "",
      includeEmpty: false,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Konten saya"
        description="Seluruh konten stakeholder Anda, termasuk draf dan riwayat keputusan."
        actions={
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
              Ekspor mengikuti filter status dan sub-tema aktif.
            </p>
          </div>
        }
      />

      <FilterBar
        action="/client/konten"
        label="Filter konten"
        idPrefix="konten-saya"
        resetHref="/client/konten"
        fields={filterFields}
        summary={`${submissions.length} konten ditampilkan, maksimal 100 terbaru.`}
      />

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
              <caption className="sr-only">
                Daftar konten Anda beserta statusnya
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
                  <tr
                    key={item.id}
                    className="border-b border-border/70 last:border-0"
                  >
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
                    <td className="px-5 py-3 text-ink-muted">
                      {item.themeName}
                    </td>
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
        Hanya konten berstatus {STATUS_LABEL.APPROVED} yang dihitung dalam
        capaian. Draf, konten yang ditolak, perlu revisi, dicabut, atau
        diarsipkan tidak menambah angka.
      </p>
    </PageContainer>
  );
}
