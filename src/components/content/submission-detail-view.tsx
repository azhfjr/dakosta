import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardCheck,
  ExternalLink,
  History,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import { StatusBadge } from "@/components/content/status-badge";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, PLATFORM_LABEL } from "@/lib/content-status";
import { formatDateId, formatDateTimeId } from "@/lib/dates";
import {
  CONTENT_TYPE_LABELS,
  MAIN_THEME_LABELS,
  SUB_THEME_LABELS,
  isContentType,
  isMainTheme,
  isSubTheme,
} from "@/lib/edufast/policy";
import type { SubmissionDetail } from "@/lib/submissions";

const SOURCE_LABEL: Record<string, string> = {
  device_gps: "GPS perangkat",
  manual_pin: "Pin manual",
  registered_stakeholder: "Lokasi terdaftar organisasi",
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
  REVOKE: "Dicabut",
};

function coordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function SubmissionDetailView({
  detail,
  backHref,
  backLabel,
  decisionNote,
  actions,
  aside,
  securityNote,
}: {
  detail: SubmissionDetail;
  backHref: string;
  backLabel: string;
  decisionNote?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  securityNote?: ReactNode;
}) {
  const mapLink = detail.location
    ? `https://www.openstreetmap.org/?mlat=${detail.location.latitude}&mlon=${detail.location.longitude}#map=16/${detail.location.latitude}/${detail.location.longitude}`
    : null;

  const contentTypeLabel = isContentType(detail.contentType)
    ? CONTENT_TYPE_LABELS[detail.contentType]
    : null;
  const mainThemeLabel = isMainTheme(detail.mainTheme)
    ? MAIN_THEME_LABELS[detail.mainTheme]
    : null;
  const subThemeLabel = isSubTheme(detail.subTheme)
    ? SUB_THEME_LABELS[detail.subTheme]
    : null;

  return (
    <PageContainer>
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8">
          <Link href={backHref}>
            <ArrowLeft className="mr-1.5 size-4" aria-hidden />
            {backLabel}
          </Link>
        </Button>
        <span aria-hidden>/</span>
        <span className="truncate">{detail.referenceCode}</span>
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight break-words text-foreground sm:text-2xl">
              {detail.title ?? "(tanpa judul)"}
            </h1>
            <StatusBadge status={detail.status} />
            <span className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted">
              v{detail.version}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            <span className="font-mono text-xs">{detail.referenceCode}</span>
            {" · dikirim "}
            {formatDateTimeId(detail.submittedAt)} WIB
            {detail.approvedAt
              ? ` · disetujui ${formatDateTimeId(detail.approvedAt)} WIB`
              : ""}
            {detail.resubmissionCount > 0
              ? ` · ${detail.resubmissionCount}× dikirim ulang`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          {actions}
          <Button asChild variant="outline" className="h-10">
            <a
              href={detail.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Buka konten
              <ExternalLink className="ml-1.5 size-4" aria-hidden />
            </a>
          </Button>
        </div>
      </header>

      {decisionNote ? (
        <div className="rounded-xl border border-border bg-surface-muted/70 p-4 text-sm leading-relaxed text-ink-muted">
          {decisionNote}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)] xl:gap-6">
        <div className="space-y-5 sm:space-y-6">
          <section
            aria-labelledby="konten-title"
            className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
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

            <dl className="mt-5 grid gap-x-6 gap-y-5 border-t border-border pt-5 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Organisasi
                </dt>
                <dd className="mt-1 text-sm font-medium break-words text-foreground">
                  {detail.stakeholder.name}
                </dd>
                <dd className="text-xs text-ink-muted">
                  {detail.stakeholder.serviceArea}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Tema
                </dt>
                <dd className="mt-1 text-sm break-words text-foreground">
                  {mainThemeLabel ?? detail.theme.name}
                </dd>
                <dd className="text-xs text-ink-muted">
                  {subThemeLabel ?? detail.theme.name}
                  {detail.edufastPolicyVersion
                    ? ` · kebijakan EDUFAST v${detail.edufastPolicyVersion}`
                    : ""}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Jenis & platform
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {contentTypeLabel ?? "Belum ditentukan"}
                </dd>
                <dd className="text-xs text-ink-muted">
                  {PLATFORM_LABEL[detail.platform] ?? detail.platform}
                </dd>
              </div>
              <div className="min-w-0">
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
              <div className="min-w-0 sm:col-span-2">
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
            className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
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
                <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-muted">Koordinat</dt>
                    <dd className="mt-1 font-medium text-foreground tabular">
                      {coordinates(
                        detail.location.latitude,
                        detail.location.longitude,
                      )}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-muted">Sumber</dt>
                    <dd className="mt-1 break-words text-foreground">
                      {SOURCE_LABEL[detail.location.source] ??
                        detail.location.source}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-muted">Presisi</dt>
                    <dd className="mt-1 text-foreground">
                      {PRECISION_LABEL[detail.location.precision] ??
                        detail.location.precision}
                      {detail.location.accuracyMeters
                        ? ` · ±${Math.round(detail.location.accuracyMeters)} m`
                        : ""}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-muted">Verifikasi</dt>
                    <dd className="mt-1 text-foreground">
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
            className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
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
                <p>Belum ada keputusan untuk konten ini.</p>
              </div>
            ) : (
              <ol className="mt-4 space-y-3">
                {detail.reviews.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-lg border border-border bg-surface-muted/40 p-3 sm:p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {REVIEW_ACTION_LABEL[review.action] ?? review.action} ·
                        v{review.version}
                      </p>
                      <p className="text-xs whitespace-nowrap text-ink-muted tabular">
                        {formatDateTimeId(review.createdAt)} WIB
                      </p>
                    </div>
                    <p className="mt-1 text-xs break-words text-ink-muted">
                      Oleh {review.reviewerName}
                      {review.conflictOfInterest
                        ? " · ditandai konflik kepentingan"
                        : ""}
                    </p>
                    {review.notes ? (
                      <p className="mt-2 text-sm leading-relaxed break-words text-ink">
                        {review.notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}

            {detail.revisions.length > 0 ? (
              <div className="mt-5 border-t border-border pt-5">
                <h3 className="text-sm font-medium text-foreground">
                  Versi tersimpan
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-ink-muted">
                  {detail.revisions.map((revision) => (
                    <li key={revision.id} className="break-words">
                      <span className="tabular">v{revision.version}</span> ·{" "}
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
              {securityNote ??
                "Data pada DAKOSTA adalah data operasional organisasi. Sistem tidak menyimpan nomor identitas, nomor kepesertaan, atau rekam medis pasien. Setiap keputusan tercatat pada audit log."}
            </p>
          </div>
        </div>

        {aside ?? null}
      </div>
    </PageContainer>
  );
}

export function ReadOnlyDecisionNote({
  status,
  role,
}: {
  status: keyof typeof STATUS_LABEL;
  role: string;
}) {
  return (
    <p>
      Konten ini berstatus{" "}
      <span className="font-medium text-foreground">
        {STATUS_LABEL[status]}
      </span>
      . Peran {role} bersifat baca-saja; keputusan validasi dilakukan oleh Admin
      Cabang pada lingkupnya.
    </p>
  );
}
