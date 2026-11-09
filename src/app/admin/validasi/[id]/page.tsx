import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
  ExternalLink,
  History,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import { ReviewPanel } from "@/components/admin/review-panel";
import { RevokePanel } from "@/components/admin/revoke-panel";
import { StatusBadge } from "@/components/content/status-badge";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/errors";
import {
  isPendingStatus,
  PLATFORM_LABEL,
  STATUS_LABEL,
  type ContentStatus,
} from "@/lib/content-status";
import { formatDateId, formatDateTimeId } from "@/lib/dates";
import { getSubmissionDetail } from "@/lib/submissions";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Tinjau konten",
};

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  device_gps: "GPS perangkat",
  manual_pin: "Pin manual",
  registered_stakeholder: "Lokasi terdaftar stakeholder",
};

const PRECISION_LABEL: Record<string, string> = {
  exact: "Presisi",
  approximate: "Perkiraan",
};

const VERIFIED_LABEL: Record<string, string> = {
  VERIFIED: "Terverifikasi",
  MANUAL_UNVERIFIED: "Belum diverifikasi",
};

const REVIEW_ACTION_LABEL: Record<string, string> = {
  APPROVE: "Disetujui",
  REQUEST_REVISION: "Diminta revisi",
  REJECT: "Ditolak",
};

function coordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireRole("ADMIN");
  const { id } = await params;

  let detail;
  try {
    detail = await getSubmissionDetail(admin, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const canReview = isPendingStatus(detail.status);
  const mapLink = detail.location
    ? `https://www.openstreetmap.org/?mlat=${detail.location.latitude}&mlon=${detail.location.longitude}#map=16/${detail.location.latitude}/${detail.location.longitude}`
    : null;

  return (
    <PageContainer>
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Button asChild variant="ghost" size="sm" className="h-8 -ml-2">
          <Link href="/admin/validasi">
            <ArrowLeft className="mr-1.5 size-4" aria-hidden />
            Antrean validasi
          </Link>
        </Button>
        <span aria-hidden>/</span>
        <span className="truncate">{detail.referenceCode}</span>
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {detail.title ?? "(tanpa judul)"}
            </h1>
            <StatusBadge status={detail.status} />
            <span className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted">
              v{detail.version}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {detail.referenceCode} · dikirim{" "}
            {formatDateTimeId(detail.submittedAt)} WIB
          </p>
        </div>
        <Button asChild variant="outline" className="h-10 self-start">
          <a
            href={detail.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Lihat konten
            <ExternalLink className="ml-1.5 size-4" aria-hidden />
          </a>
        </Button>
      </header>

      {!canReview ? (
        <div className="rounded-xl border border-border bg-surface-muted/70 p-4 text-sm leading-relaxed text-ink-muted">
          Konten ini sudah diputuskan dengan status{" "}
          <span className="font-medium text-foreground">
            {STATUS_LABEL[detail.status as ContentStatus]}
          </span>
          . Panel keputusan dinonaktifkan; riwayat tetap dapat ditelusuri.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
        <div className="space-y-6">
          <section
            aria-labelledby="konten-title"
            className="rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <h2
              id="konten-title"
              className="text-base font-semibold text-foreground"
            >
              Narasi konten
            </h2>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ink">
              {detail.narrative}
            </p>

            <dl className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Stakeholder
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {detail.stakeholder.name}
                </dd>
                <dd className="text-xs text-ink-muted">
                  {detail.stakeholder.serviceArea}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Tema
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {detail.theme.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Platform
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {PLATFORM_LABEL[detail.platform] ?? detail.platform}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Tanggal konten
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  Dibuat {formatDateId(detail.dateCreated)}
                  {detail.publishedAt
                    ? ` · terbit ${formatDateId(detail.publishedAt)}`
                    : ""}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Tautan publik
                </dt>
                <dd className="mt-1">
                  <a
                    href={detail.publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-sm text-brand-blue-700 underline-offset-4 hover:underline"
                  >
                    {detail.publishedUrl}
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="lokasi-title"
            className="rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-brand-teal-700" aria-hidden />
              <h2
                id="lokasi-title"
                className="text-base font-semibold text-foreground"
              >
                Lokasi konten
              </h2>
            </div>

            {detail.location ? (
              <>
                <p className="mt-3 text-sm font-medium text-foreground">
                  {detail.location.label}
                </p>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-ink-muted">Koordinat</dt>
                    <dd className="mt-0.5 font-medium text-foreground tabular">
                      {coordinates(
                        detail.location.latitude,
                        detail.location.longitude,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Sumber</dt>
                    <dd className="mt-0.5 text-foreground">
                      {SOURCE_LABEL[detail.location.source] ??
                        detail.location.source}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Presisi</dt>
                    <dd className="mt-0.5 text-foreground">
                      {PRECISION_LABEL[detail.location.precision] ??
                        detail.location.precision}
                      {detail.location.accuracyMeters
                        ? ` · ±${Math.round(detail.location.accuracyMeters)} m`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Verifikasi</dt>
                    <dd className="mt-0.5 text-foreground">
                      {VERIFIED_LABEL[detail.location.verifiedStatus] ??
                        detail.location.verifiedStatus}
                    </dd>
                  </div>
                </dl>
                {mapLink ? (
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue-700 underline-offset-4 hover:underline"
                  >
                    Lihat titik di OpenStreetMap
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">
                Lokasi tidak tersedia pada konten ini.
              </p>
            )}
          </section>

          <section
            aria-labelledby="riwayat-title"
            className="rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <History className="size-4 text-ink-muted" aria-hidden />
              <h2
                id="riwayat-title"
                className="text-base font-semibold text-foreground"
              >
                Riwayat & keputusan sebelumnya
              </h2>
            </div>

            {detail.reviews.length === 0 ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-ink-muted">
                <ClipboardCheck
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                <p>Belum ada keputusan admin untuk konten ini.</p>
              </div>
            ) : (
              <ol className="mt-4 space-y-3">
                {detail.reviews.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-lg border border-border bg-surface-muted/40 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {REVIEW_ACTION_LABEL[review.action] ?? review.action} ·
                        v{review.version}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatDateTimeId(review.createdAt)} WIB
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      Oleh {review.reviewerName}
                      {review.conflictOfInterest
                        ? " · ditandai konflik kepentingan"
                        : ""}
                    </p>
                    {review.notes ? (
                      <p className="mt-2 text-sm leading-relaxed text-ink">
                        {review.notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}

            {detail.revisions.length > 0 ? (
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="text-sm font-medium text-foreground">
                  Versi tersimpan
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
                  {detail.revisions.map((revision) => (
                    <li key={revision.id}>
                      v{revision.version} ·{" "}
                      {formatDateTimeId(revision.createdAt)} WIB ·{" "}
                      {revision.actorName}
                      {revision.reason ? ` · ${revision.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <div className="flex items-start gap-2 rounded-xl border border-brand-blue-100 bg-brand-blue-100/40 p-4 text-xs leading-relaxed text-brand-blue-800">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Konten ini diverifikasi tanpa data pribadi, nomor identitas, atau
              rekam medis. Keputusan reviewer menulis ulasan, notifikasi, dan
              audit dalam satu transaksi.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <ReviewPanel
            submissionId={detail.id}
            expectedVersion={detail.version}
            canReview={canReview}
            decidedStatus={STATUS_LABEL[detail.status as ContentStatus]}
            status={detail.status}
          />
          {detail.status === "APPROVED" ? (
            <RevokePanel submissionId={detail.id} />
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
