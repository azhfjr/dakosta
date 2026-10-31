import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { listAuditLogs } from "@/lib/audit-log";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Jejak audit",
};

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  SUBMISSION_CREATED: "Konten dibuat",
  SUBMISSION_SUBMITTED: "Konten dikirim",
  SUBMISSION_UPDATED: "Konten diperbarui",
  SUBMISSION_UPDATED_ON_BEHALF: "Konten diperbarui atas nama",
  REVIEW_APPROVED: "Disetujui",
  REVIEW_REVISION_REQUESTED: "Diminta revisi",
  REVIEW_REJECTED: "Ditolak",
  CONTENT_REVOKED: "Konten dicabut",
  USER_CREATED: "Pengguna dibuat",
  USER_DEACTIVATED: "Pengguna dinonaktifkan",
  USER_ACTIVATED: "Pengguna diaktifkan",
  ACCESS_DENIED: "Akses ditolak",
  DEMO_LOGIN: "Demo masuk",
  OUTBOX_DRAINED: "Outbox diproses",
  KPI_TARGET_UPDATED: "Target diperbarui",
  TARGET_CREATED: "Target dibuat",
  TARGET_UPDATED: "Target diperbarui",
  TARGET_DELETED: "Target dihapus",
  TARGET_SYNCED: "Target disinkronkan",
};

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const action = firstParam(params.action)?.slice(0, 64) || undefined;
  const page = Math.max(Number(firstParam(params.page) ?? 1) || 1, 1);

  const log = await listAuditLogs({ page, pageSize: 40, action });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Jejak audit
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Catatan tindakan administratif dan keputusan validasi. Metadata
            disimpan tanpa kredensial atau data pribadi.
          </p>
        </div>
        <p className="text-xs text-ink-muted">
          {formatNumberId(log.total)} catatan
        </p>
      </header>

      <nav aria-label="Filter aksi audit" className="flex flex-wrap gap-1.5">
        <Link
          href="/admin/audit"
          aria-current={action ? undefined : "page"}
          className={
            action
              ? "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              : "rounded-full bg-brand-blue-700 px-3 py-1.5 text-xs font-semibold text-white"
          }
        >
          Semua aksi
        </Link>
        {log.actions.map((value) => {
          const active = action === value;
          return (
            <Link
              key={value}
              href={`/admin/audit?action=${encodeURIComponent(value)}`}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-full bg-brand-blue-700 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              }
            >
              {actionLabel(value)}
            </Link>
          );
        })}
      </nav>

      <section
        aria-labelledby="audit-daftar"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="border-b border-border px-5 py-3">
          <h2 id="audit-daftar" className="text-base font-semibold text-foreground">
            Catatan terbaru
          </h2>
          <p className="text-xs text-ink-muted">
            Halaman {log.page} dari {log.pageCount} · {log.pageSize} catatan per halaman
          </p>
        </div>

        {log.rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <ScrollText className="mx-auto size-8 text-ink-muted" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">
              Belum ada catatan audit
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Catatan muncul setelah pengguna melakukan tindakan yang diaudit.
            </p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[60rem] border-collapse text-sm">
              <caption className="sr-only">
                Catatan audit terbaru dengan aktor, aksi, dan objek terkait
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-5 py-3">Waktu</th>
                  <th scope="col" className="px-5 py-3">Aktor</th>
                  <th scope="col" className="px-5 py-3">Aksi</th>
                  <th scope="col" className="px-5 py-3">Objek</th>
                  <th scope="col" className="px-5 py-3">Request</th>
                  <th scope="col" className="px-5 py-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {log.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/70 align-top last:border-0"
                  >
                    <td className="px-5 py-3 whitespace-nowrap text-ink-muted">
                      {formatDateTimeId(row.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="block text-foreground">
                        {row.actorName ?? "Sistem"}
                      </span>
                      <span className="text-xs text-ink-muted">{row.actorRole}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="block font-medium text-foreground">
                        {actionLabel(row.action)}
                      </span>
                      <span className="font-mono text-xs text-ink-muted">
                        {row.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      <span className="block text-foreground">{row.recordType}</span>
                      {row.recordId ? (
                        <span className="font-mono text-xs break-all">
                          {row.recordId}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-ink-muted">
                      {row.requestId ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {row.after ? (
                        <details className="max-w-xs">
                          <summary className="cursor-pointer text-xs select-none">
                            Lihat metadata
                          </summary>
                          <pre className="mt-1 max-h-40 overflow-auto rounded bg-surface-muted p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
                            {JSON.stringify(row.after, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {log.pageCount > 1 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 sm:flex-row">
            <p className="text-xs text-ink-muted">
              Halaman {log.page} dari {log.pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9"
                aria-disabled={log.page <= 1}
              >
                <Link
                  href={`/admin/audit${buildQuery({
                    action,
                    page: String(Math.max(1, log.page - 1)),
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
                aria-disabled={log.page >= log.pageCount}
              >
                <Link
                  href={`/admin/audit${buildQuery({
                    action,
                    page: String(Math.min(log.pageCount, log.page + 1)),
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
