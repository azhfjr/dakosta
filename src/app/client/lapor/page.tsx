import type { Metadata } from "next";
import Link from "next/link";
import { asc, and, eq, inArray } from "drizzle-orm";
import { Info } from "lucide-react";

import { SubmissionWizard } from "@/components/forms/submission-wizard";
import { Button } from "@/components/ui/button";
import { getDb, schema } from "@/db";
import { jakartaToday } from "@/lib/dates";
import { listPolicies } from "@/lib/edufast/policy";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Lapor konten",
};

export const dynamic = "force-dynamic";

export default async function ReportContentPage() {
  const user = await requireRole("CLIENT");
  const db = getDb();

  const [stakeholders, policies] = await Promise.all([
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
  ]);

  const edufastPolicies = Object.fromEntries(
    policies
      .filter((policy) => policy.status === "PUBLISHED")
      .map((policy) => [policy.period, policy.subThemes]),
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-ink-muted">
          <Link href="/client" className="underline-offset-4 hover:underline">
            Beranda
          </Link>{" "}
          / Lapor konten
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Lapor konten kolaborasi
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          Lengkapi tautan, narasi, tema, dan lokasi konten. Reviewer cabang akan
          memvalidasi sebelum konten dihitung sebagai capaian. Jangan memuat data
          pribadi, nomor identitas, atau rekam medis.
        </p>
      </header>

      {stakeholders.length === 0 ? (
        <div className="rounded-xl border border-status-review/30 bg-status-review/5 p-5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-5 shrink-0 text-status-review" aria-hidden />
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Akun belum terhubung ke stakeholder aktif
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  Pelaporan memerlukan keterkaitan dengan minimal satu organisasi aktif.
                  Hubungi Master Admin untuk menautkan akun Anda.
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
        />
      )}

      <section className="rounded-xl border border-border bg-surface-muted/60 p-4 text-sm leading-relaxed text-ink-muted">
        <h2 className="text-sm font-semibold text-foreground">Sebelum mengirim</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Tautan harus dapat dibuka publik dan memakai https.</li>
          <li>Lokasi wajib ditandai; GPS opsional, pin manual selalu tersedia.</li>
          <li>Jangan memuat data pribadi, nomor identitas, atau rekam medis.</li>
          <li>Konten yang ditolak atau perlu revisi tidak menambah capaian.</li>
        </ul>
      </section>
    </div>
  );
}
