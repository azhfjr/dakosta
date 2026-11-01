import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LoginForm } from "@/components/auth/login-form";
import { SiteFooter } from "@/components/site-footer";
import { isDemoMode } from "@/lib/env";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Masuk ke ruang demo DAKOSTA.",
};

export default async function MasukPage() {
  const user = await getSessionUser();
  if (user) {
    redirect(user.mustChangePassword ? "/ganti-password" : user.homePath);
  }
  const demo = isDemoMode;

  return (
    <>
      <main id="konten" className="flex-1">
        <div className="mx-auto grid min-h-[calc(100vh-12rem)] w-full max-w-7xl lg:grid-cols-[1.05fr_1fr]">
          <section className="relative hidden flex-col justify-between overflow-hidden bg-surface-muted p-10 lg:flex xl:p-14">
            <div
              aria-hidden
              className="surface-grid pointer-events-none absolute inset-0 opacity-60"
            />
            <div className="relative">
              <Link href="/" aria-label="Kembali ke beranda DAKOSTA">
                <BrandLogo priority className="w-[17rem]" />
              </Link>
            </div>

            <div className="relative max-w-lg space-y-6 py-12">
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-blue-100 bg-surface px-3 py-1 text-xs font-medium tracking-wide text-brand-blue-700 uppercase">
                {demo ? "Ruang demonstrasi" : "Ruang kerja"}
              </p>
              <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-brand-blue-900 xl:text-5xl">
                Satu alur kerja untuk pelaporan konten yang dapat diaudit.
              </h1>
              <p className="text-base leading-relaxed text-ink-muted">
                DAKOSTA menghubungkan laporan stakeholder, validasi reviewer
                cabang, dan capaian yang hanya dihitung dari konten disetujui.{" "}
                {demo
                  ? "Semua data di sini sintetis dan berlabel DEMO."
                  : "Capaian mengikuti dasar tanggal konten dan dapat diekspor untuk pelaporan."}
              </p>
              <div className="h-1.5 w-32 rounded-full brand-rule" aria-hidden />
            </div>

            <p className="relative max-w-md text-sm leading-relaxed text-ink-muted">
              Proyek demonstrasi pribadi.
            </p>
          </section>

          <section className="flex flex-col justify-center px-4 py-12 sm:px-8 lg:px-12 xl:px-16">
            <div className="mx-auto w-full max-w-md space-y-8">
              <div className="space-y-4 lg:hidden">
                <Link href="/" aria-label="Kembali ke beranda DAKOSTA">
                  <BrandLogo priority className="w-[15rem]" />
                </Link>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Masuk ke DAKOSTA
                </h2>
                <p className="text-sm leading-relaxed text-ink-muted">
                  Gunakan akun yang diberikan Master Admin. Sesi Anda
                  diverifikasi di server; peran tidak ditentukan oleh browser.
                </p>
              </div>

              <LoginForm demoMode={isDemoMode} />

              <p className="text-xs leading-relaxed text-ink-muted">
                Dengan masuk, Anda memahami bahwa ini adalah demo pribadi
                nonkomersial dan bukan sistem resmi institusi mana pun.
              </p>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter compact />
    </>
  );
}
