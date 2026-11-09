import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import { StatusBadge } from "@/components/content/status-badge";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { PLATFORM_LABEL } from "@/lib/content-status";
import { formatDateId, formatDateTimeId } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/session";
import { getSubmissionDetail } from "@/lib/submissions";

export const metadata: Metadata = {
  title: "Detail konten",
};

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  device_gps: "GPS perangkat",
  manual_pin: "Pin manual",
  registered_stakeholder: "Lokasi terdaftar stakeholder",
};

export default async function ClientContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("CLIENT");
  const { id } = await params;

  let detail;
  try {
    detail = await getSubmissionDetail(user, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    if (error instanceof AppError && error.status === 403)
      redirect("/akses-ditolak");
    throw error;
  }

  return (
    <PageContainer>
      <div>
        <Link
          href="/client/konten"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke daftar konten
        </Link>
      </div>

      <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs tracking-wide text-ink-muted">
              {detail.referenceCode}
            </span>
            <StatusBadge status={detail.status} />
            <span className="text-xs text-ink-muted">
              Versi {detail.version}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {detail.title ?? "(tanpa judul)"}
          </h1>
          <p className="text-sm text-ink-muted">
            {detail.stakeholder.name} · {detail.stakeholder.serviceArea}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {detail.status === "REVISION_REQUIRED" ||
          detail.status === "DRAFT" ? (
            <Button asChild className="h-11">
              <Link href={`/client/lapor?submissionId=${detail.id}`}>
                {detail.status === "DRAFT"
                  ? "Lanjutkan draf"
                  : "Perbaiki & kirim ulang"}
              </Link>
            </Button>
          ) : null}
          <a
            href={detail.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-brand-blue-800 hover:bg-surface-muted"
          >
            Lihat konten
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Narasi</h2>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ink">
              {detail.narrative || "Belum ada narasi."}
            </p>
          </section>

          {detail.decisionReason ? (
            <section className="rounded-xl border border-brand-blue-100 bg-brand-blue-100/40 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-blue-800">
                <ShieldCheck className="size-4" aria-hidden />
                Catatan keputusan admin
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-brand-blue-900">
                {detail.decisionReason}
              </p>
            </section>
          ) : null}

          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">
              Detail pelaporan
            </h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-muted">Tema</dt>
                <dd className="font-medium text-foreground">
                  {detail.theme.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Platform</dt>
                <dd className="font-medium text-foreground">
                  {PLATFORM_LABEL[detail.platform] ?? detail.platform}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Tanggal pembuatan</dt>
                <dd className="flex items-center gap-1.5 font-medium text-foreground">
                  <CalendarDays className="size-4 text-ink-muted" aria-hidden />
                  {formatDateId(detail.dateCreated)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Tanggal terbit</dt>
                <dd className="font-medium text-foreground">
                  {formatDateId(detail.publishedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Dikirim</dt>
                <dd className="font-medium text-foreground">
                  {formatDateTimeId(detail.submittedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Disetujui</dt>
                <dd className="font-medium text-foreground">
                  {formatDateTimeId(detail.approvedAt)}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs text-ink-muted">Tautan</dt>
                <dd className="break-all text-brand-blue-800">
                  {detail.publishedUrl}
                </dd>
              </div>
            </dl>
          </section>

          {detail.location ? (
            <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MapPin className="size-4 text-brand-blue-700" aria-hidden />
                Lokasi konten
              </h2>
              <p className="mt-2 text-sm font-medium text-foreground">
                {detail.location.label}
              </p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-muted">Koordinat</dt>
                  <dd className="font-mono text-xs text-ink">
                    {detail.location.latitude.toFixed(5)},{" "}
                    {detail.location.longitude.toFixed(5)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Sumber</dt>
                  <dd className="text-ink">
                    {SOURCE_LABEL[detail.location.source] ??
                      detail.location.source}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Presisi</dt>
                  <dd className="text-ink">
                    {detail.location.precision === "exact"
                      ? "Presisi"
                      : "Perkiraan"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Status verifikasi</dt>
                  <dd className="text-ink">
                    {detail.location.verifiedStatus === "VERIFIED"
                      ? "Terverifikasi perangkat"
                      : "Belum diverifikasi"}
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section
            aria-labelledby="riwayat-title"
            className="rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <h2
              id="riwayat-title"
              className="text-sm font-semibold text-foreground"
            >
              Riwayat
            </h2>
            <ol className="mt-4 space-y-4">
              {detail.timeline.map((entry, index) => (
                <li key={entry.key} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={[
                        "mt-1 size-2.5 rounded-full",
                        index === detail.timeline.length - 1
                          ? "bg-brand-blue-700"
                          : "bg-border",
                      ].join(" ")}
                      aria-hidden
                    />
                    {index < detail.timeline.length - 1 ? (
                      <span
                        className="mt-1 h-full w-px bg-border"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-medium text-foreground">
                      {entry.label}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                      {entry.description}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {formatDateTimeId(entry.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {detail.reviews.length > 0 ? (
            <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">
                Keputusan admin
              </h2>
              <ul className="mt-3 space-y-3">
                {detail.reviews.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-lg border border-border px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {review.action === "APPROVE"
                        ? "Disetujui"
                        : review.action === "REQUEST_REVISION"
                          ? "Perlu revisi"
                          : review.action === "REVOKE"
                            ? "Dicabut"
                            : "Ditolak"}{" "}
                      <span className="text-xs font-normal text-ink-muted">
                        · versi {review.version}
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      {review.notes ?? "Tanpa catatan tambahan."}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {review.reviewerName} ·{" "}
                      {formatDateTimeId(review.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </PageContainer>
  );
}
