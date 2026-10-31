import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { inArray } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { getDb, schema } from "@/db";
import { STATUS_TONE } from "@/lib/content-status";
import { formatDateId } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { STAKEHOLDER_CATEGORY_LABEL } from "@/lib/stakeholders";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Profil",
};

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const user = await requireRole("CLIENT");

  const memberships =
    user.stakeholderIds.length > 0
      ? await getDb()
          .select({
            id: schema.stakeholders.id,
            name: schema.stakeholders.name,
            category: schema.stakeholders.category,
            serviceArea: schema.stakeholders.serviceArea,
            status: schema.stakeholders.status,
            joinedAt: schema.stakeholders.joinedAt,
          })
          .from(schema.stakeholders)
          .where(inArray(schema.stakeholders.id, user.stakeholderIds))
          .orderBy(schema.stakeholders.name)
      : [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Profil</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Identitas akun, stakeholder yang Anda wakili, dan pengaturan keamanan.
        </p>
      </header>

      <section
        aria-labelledby="akun-title"
        className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6"
      >
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-ink-muted" aria-hidden />
          <h2 id="akun-title" className="text-sm font-semibold text-foreground">
            Akun
          </h2>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              Nama
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              Peran
            </dt>
            <dd className="mt-1 flex items-center gap-2 text-sm text-foreground">
              <ShieldCheck className="size-4 text-brand-teal-700" aria-hidden />
              {user.displayTitle ?? "Perwakilan stakeholder"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              Email
            </dt>
            <dd className="mt-1 flex items-center gap-2 text-sm text-foreground">
              <Mail className="size-4 text-ink-muted" aria-hidden />
              <span className="break-all">{user.email}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">
              Status akun
            </dt>
            <dd className="mt-1">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
                  STATUS_TONE.APPROVED,
                )}
              >
                Aktif
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="stakeholder-title"
        className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6"
      >
        <h2 id="stakeholder-title" className="text-sm font-semibold text-foreground">
          Stakeholder yang diwakili
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Konten yang Anda laporkan tercatat atas nama stakeholder berikut. Perubahan
          keanggotaan hanya dapat dilakukan oleh admin.
        </p>
        {memberships.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-ink-muted">
            Belum ada stakeholder yang terhubung ke akun ini. Hubungi admin DAKOSTA.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {memberships.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {STAKEHOLDER_CATEGORY_LABEL[item.category] ?? item.category} ·{" "}
                    {item.serviceArea}
                  </p>
                </div>
                <div className="text-right text-xs text-ink-muted">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
                      item.status === "ACTIVE"
                        ? STATUS_TONE.APPROVED
                        : STATUS_TONE.ARCHIVED,
                    )}
                  >
                    {item.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                  </span>
                  <p className="mt-1">Bergabung {formatDateId(item.joinedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="keamanan-title"
        className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-ink-muted" aria-hidden />
          <h2 id="keamanan-title" className="text-sm font-semibold text-foreground">
            Keamanan
          </h2>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Kata sandi minimal 12 karakter. Sesi berlaku tujuh hari dan diperbarui setiap
          kali Anda aktif.
        </p>
        <Button asChild variant="outline" className="mt-4 h-11">
          <Link href="/ganti-password">Ganti kata sandi</Link>
        </Button>
      </section>

      <p className="text-xs leading-relaxed text-ink-muted">
        Akun ini tidak menyimpan data pasien, NIK, atau nomor JKN. DAKOSTA adalah
        proyek independen.
      </p>
    </div>
  );
}
