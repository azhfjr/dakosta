import Link from "next/link";

import { StatusBadge } from "@/components/content/status-badge";
import { formatDateId, formatDateTimeId, formatNumberId } from "@/lib/dates";
import { PLATFORM_LABEL, STATUS_LABEL, type ContentStatus } from "@/lib/content-status";
import type { SubmissionListItem } from "@/lib/submissions";

export function ContentListView({
  items,
  counts,
  basePath,
  title,
  description,
}: {
  items: SubmissionListItem[];
  counts: Record<ContentStatus, number>;
  basePath: string;
  title: string;
  description: string;
}) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>
      </header>

      <section aria-label="Ringkasan status konten" className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {(
          [
            ["APPROVED", counts.APPROVED],
            ["SUBMITTED", counts.SUBMITTED + counts.RESUBMITTED],
            ["IN_REVIEW", counts.IN_REVIEW],
            ["REVISION_REQUIRED", counts.REVISION_REQUIRED],
            ["REJECTED", counts.REJECTED],
            ["DRAFT", counts.DRAFT],
          ] as Array<[ContentStatus, number]>
        ).map(([status, value]) => (
          <div key={status} className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              {STATUS_LABEL[status]}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {formatNumberId(value)}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Daftar konten</h2>
          <p className="text-xs text-ink-muted">{formatNumberId(total)} konten</p>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-muted">
            Belum ada konten pada lingkup ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <caption className="sr-only">Daftar konten pada lingkup akses Anda</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    Konten
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Organisasi
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Tema / platform
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Tanggal konten
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/70 last:border-0 align-top">
                    <td className="px-4 py-4">
                      <Link
                        href={`${basePath}/${item.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {item.title ?? "(tanpa judul)"}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {item.referenceCode} · v{item.version}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-ink-muted">{item.stakeholderName}</td>
                    <td className="px-4 py-4 text-ink-muted">
                      <span className="block text-foreground">{item.themeName}</span>
                      <span className="text-xs">
                        {PLATFORM_LABEL[item.platform] ?? item.platform}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-ink-muted">
                      <span className="block">{formatDateId(item.dateCreated)}</span>
                      <span className="text-xs">
                        {item.submittedAt
                          ? `Dikirim ${formatDateTimeId(item.submittedAt)}`
                          : "Belum dikirim"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`${basePath}/${item.id}`}
                        className="text-sm font-medium text-brand-blue-800 underline-offset-4 hover:underline"
                      >
                        Lihat
                      </Link>
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
