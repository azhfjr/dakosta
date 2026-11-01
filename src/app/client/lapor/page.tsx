import type { Metadata } from "next";
import Link from "next/link";
import { asc, and, eq, inArray } from "drizzle-orm";
import { Info } from "lucide-react";

import {
  SubmissionWizard,
  type SubmissionWizardInitial,
} from "@/components/forms/submission-wizard";
import { Button } from "@/components/ui/button";
import { getDb, schema } from "@/db";
import { jakartaToday } from "@/lib/dates";
import { listPolicies } from "@/lib/edufast/policy";
import { requireRole } from "@/lib/session";
import { STATUS_LABEL, type ContentStatus } from "@/lib/content-status";

export const metadata: Metadata = {
  title: "Lapor konten",
};

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReportContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("CLIENT");
  const params = await searchParams;
  const rawSubmissionId = Array.isArray(params.submissionId)
    ? params.submissionId[0]
    : params.submissionId;
  const submissionId =
    rawSubmissionId && UUID_PATTERN.test(rawSubmissionId)
      ? rawSubmissionId
      : null;
  const db = getDb();

  const [stakeholders, policies, draftRows] = await Promise.all([
    user.stakeholderIds.length > 0
      ? db
          .select({
            id: schema.stakeholders.id,
            name: schema.stakeholders.name,
            serviceArea: schema.stakeholders.serviceArea,
            organizationType: schema.stakeholders.organizationType,
            faskesClass: schema.stakeholders.faskesClass,
            latitude: schema.stakeholders.latitude,
            longitude: schema.stakeholders.longitude,
            branchName: schema.branchOffices.name,
          })
          .from(schema.stakeholders)
          .leftJoin(
            schema.branchOffices,
            eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
          )
          .where(
            and(
              inArray(schema.stakeholders.id, user.stakeholderIds),
              eq(schema.stakeholders.status, "ACTIVE"),
            ),
          )
          .orderBy(asc(schema.stakeholders.name))
      : Promise.resolve([]),
    listPolicies(),
    submissionId
      ? db
          .select({
            id: schema.contentSubmissions.id,
            referenceCode: schema.contentSubmissions.referenceCode,
            status: schema.contentSubmissions.status,
            stakeholderId: schema.contentSubmissions.stakeholderId,
            publishedUrl: schema.contentSubmissions.publishedUrl,
            platform: schema.contentSubmissions.platform,
            contentType: schema.contentSubmissions.contentType,
            mainTheme: schema.contentSubmissions.mainTheme,
            subTheme: schema.contentSubmissions.subTheme,
            title: schema.contentSubmissions.title,
            narrative: schema.contentSubmissions.narrative,
            dateCreated: schema.contentSubmissions.dateCreated,
            publishedAt: schema.contentSubmissions.publishedAt,
            decisionReason: schema.contentSubmissions.decisionReason,
          })
          .from(schema.contentSubmissions)
          .where(
            and(
              eq(schema.contentSubmissions.id, submissionId),
              eq(schema.contentSubmissions.createdBy, user.id),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  const edufastPolicies = Object.fromEntries(
    policies
      .filter((policy) => policy.status === "PUBLISHED")
      .map((policy) => [policy.period, policy.subThemes]),
  );

  const draft = draftRows[0];
  let initial: SubmissionWizardInitial | undefined;
  let initialError: string | null = null;

  if (rawSubmissionId && !submissionId) {
    initialError = "Nomor konten tidak valid.";
  } else if (submissionId) {
    if (!draft) {
      initialError = "Konten tidak ditemukan atau bukan milik akun Anda.";
    } else if (
      draft.status !== "DRAFT" &&
      draft.status !== "REVISION_REQUIRED"
    ) {
      const label = STATUS_LABEL[draft.status as ContentStatus] ?? draft.status;
      initialError = `Konten ${draft.referenceCode} berstatus "${label}" dan tidak dapat diubah.`;
    } else if (!stakeholders.some((item) => item.id === draft.stakeholderId)) {
      initialError =
        "Organisasi pelapor tidak aktif atau tidak lagi terhubung ke akun Anda.";
    } else {
      initial = {
        submissionId: draft.id,
        referenceCode: draft.referenceCode,
        stakeholderId: draft.stakeholderId,
        publishedUrl: draft.publishedUrl,
        platform: draft.platform,
        contentType: draft.contentType,
        mainTheme: draft.mainTheme,
        subTheme: draft.subTheme,
        title: draft.title,
        narrative: draft.narrative,
        dateCreated: draft.dateCreated,
        publishedAt: draft.publishedAt,
        decisionReason: draft.decisionReason,
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-ink-muted">
          <Link href="/client" className="underline-offset-4 hover:underline">
            Beranda
          </Link>{" "}
          / {initial ? "Perbaiki konten" : "Lapor konten"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {initial ? "Perbaiki konten" : "Lapor konten kolaborasi"}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          {initial
            ? "Perbarui konten sesuai catatan reviewer, lalu kirim ulang untuk validasi. Capaian belum dihitung sampai konten disetujui."
            : "Lengkapi tautan, narasi, dan tema konten. Reviewer cabang akan memvalidasi sebelum konten dihitung sebagai capaian. Jangan memuat data pribadi, nomor identitas, atau rekam medis."}
        </p>
      </header>

      {initialError ? (
        <div className="rounded-xl border border-status-rejected/30 bg-status-rejected/5 p-5">
          <div className="flex items-start gap-3">
            <Info
              className="mt-0.5 size-5 shrink-0 text-status-rejected"
              aria-hidden
            />
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Konten tidak dapat diperbaiki
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  {initialError}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/client/konten">Kembali ke daftar konten</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : stakeholders.length === 0 ? (
        <div className="rounded-xl border border-status-review/30 bg-status-review/5 p-5">
          <div className="flex items-start gap-3">
            <Info
              className="mt-0.5 size-5 shrink-0 text-status-review"
              aria-hidden
            />
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Akun belum terhubung ke stakeholder aktif
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  Pelaporan memerlukan keterkaitan dengan minimal satu
                  organisasi aktif. Hubungi Master Admin untuk menautkan akun
                  Anda.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/client">Kembali ke beranda</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <SubmissionWizard
          stakeholders={stakeholders}
          edufastPolicies={edufastPolicies}
          today={jakartaToday()}
          draftOwnerId={user.id}
          initial={initial}
        />
      )}

      <section className="rounded-xl border border-border bg-surface-muted/60 p-4 text-sm leading-relaxed text-ink-muted">
        <h2 className="text-sm font-semibold text-foreground">
          Sebelum mengirim
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Tautan harus dapat dibuka publik dan memakai https.</li>
          <li>
            Lokasi tidak ditandai per konten; instansi memakai lokasi yang
            tersimpan saat aktivasi akun.
          </li>
          <li>
            Jangan memuat data pribadi, nomor identitas, atau rekam medis.
          </li>
          <li>Konten yang ditolak atau perlu revisi tidak menambah capaian.</li>
        </ul>
      </section>
    </div>
  );
}
