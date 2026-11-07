"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, X } from "lucide-react";

import { StatusBadge } from "@/components/content/status-badge";
import { Button } from "@/components/ui/button";
import { PLATFORM_LABEL, STATUS_LABEL } from "@/lib/content-status";
import { formatDateId, formatDateTimeId } from "@/lib/dates";
import {
  CONTENT_TYPE_LABELS,
  MAIN_THEME_LABELS,
  SUB_THEME_LABELS,
  isContentType,
  isMainTheme,
  isSubTheme,
} from "@/lib/taxonomy";
import type { SubmissionDetail } from "@/lib/submissions";

type DrawerState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; detail: SubmissionDetail };

export function ContentDetailDrawer({
  id,
  label,
  detailHref,
}: {
  id: string;
  label: string;
  detailHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DrawerState>({ kind: "loading" });

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/v1/submissions/${id}`, {
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            payload?.error?.message ?? "Detail konten tidak dapat dimuat.",
          );
        }
        if (!cancelled) {
          setState({ kind: "ready", detail: payload.data as SubmissionDetail });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "Detail konten tidak dapat dimuat.",
          });
        }
      });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKey);
    };
  }, [close, id, open]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => {
          setState({ kind: "loading" });
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        Detail
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Tutup detail"
            className="absolute inset-0 bg-ink/40"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Detail ${label}`}
            className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-surface shadow-xl"
          >
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border bg-surface px-5 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Detail konten
                </p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {label}
                </p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={close}
                aria-label="Tutup detail"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-transparent text-ink-muted outline-none hover:bg-surface-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="px-5 py-4">
              {state.kind === "loading" ? (
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Memuat detail konten…
                </p>
              ) : state.kind === "error" ? (
                <div className="rounded-lg border border-status-rejected/30 bg-status-rejected/5 px-4 py-3 text-sm text-foreground">
                  <p>{state.message}</p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href={detailHref}>Buka halaman detail</Link>
                  </Button>
                </div>
              ) : (
                <DrawerBody detail={state.detail} detailHref={detailHref} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-2 last:border-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function DrawerBody({
  detail,
  detailHref,
}: {
  detail: SubmissionDetail;
  detailHref: string;
}) {
  const contentType = isContentType(detail.contentType)
    ? CONTENT_TYPE_LABELS[detail.contentType]
    : (detail.contentType ?? "Belum ditentukan");
  const mainTheme = isMainTheme(detail.mainTheme)
    ? MAIN_THEME_LABELS[detail.mainTheme]
    : "—";
  const subTheme = isSubTheme(detail.subTheme)
    ? SUB_THEME_LABELS[detail.subTheme]
    : "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={detail.status} />
        <span className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted">
          v{detail.version}
        </span>
        <span className="font-mono text-xs text-ink-muted">
          {detail.referenceCode}
        </span>
      </div>

      <dl>
        <Row label="Judul" value={detail.title ?? "(tanpa judul)"} />
        <Row label="Organisasi" value={detail.stakeholder.name} />
        <Row label="Wilayah layanan" value={detail.stakeholder.serviceArea} />
        <Row label="Tema utama" value={mainTheme} />
        <Row label="Sub-tema" value={subTheme} />
        <Row label="Jenis konten" value={contentType} />
        <Row
          label="Platform"
          value={PLATFORM_LABEL[detail.platform] ?? detail.platform}
        />
        <Row label="Tanggal konten" value={formatDateId(detail.dateCreated)} />
        <Row label="Dikirim" value={formatDateTimeId(detail.submittedAt)} />
        <Row label="Disetujui" value={formatDateTimeId(detail.approvedAt)} />
        <Row label="Diperbarui" value={formatDateTimeId(detail.updatedAt)} />
        <Row label="Kirim ulang" value={`${detail.resubmissionCount}×`} />
      </dl>

      {detail.decisionReason ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground">
            Catatan keputusan
          </h3>
          <p className="mt-1 text-sm text-ink-muted">{detail.decisionReason}</p>
        </section>
      ) : null}

      {detail.reviews.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground">
            Riwayat validasi
          </h3>
          <ul className="mt-2 space-y-2">
            {detail.reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm"
              >
                <p className="font-medium text-foreground">
                  {STATUS_LABEL[
                    review.nextStatus as keyof typeof STATUS_LABEL
                  ] ?? review.nextStatus}{" "}
                  · v{review.version}
                </p>
                <p className="text-xs text-ink-muted">
                  {review.reviewerName} · {formatDateTimeId(review.createdAt)}
                  {review.conflictOfInterest ? " · konflik kepentingan" : ""}
                </p>
                {review.notes ? (
                  <p className="mt-1 text-xs text-ink-muted">{review.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link href={detailHref}>Buka halaman detail</Link>
        </Button>
        {detail.publishedUrl ? (
          <Button asChild variant="ghost" size="sm" className="h-9">
            <a
              href={detail.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Buka konten
              <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
