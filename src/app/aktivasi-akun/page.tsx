import type { Metadata } from "next";
import Link from "next/link";

import { ActivationForm } from "@/components/auth/activation-form";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteFooter } from "@/components/site-footer";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = {
  title: "Aktivasi akun",
  description: "Buat kata sandi pribadi untuk mengaktifkan akun DAKOSTA.",
};

export default async function ActivationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted/60">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Kembali ke beranda DAKOSTA">
            <BrandLogo variant="compact" className="w-32" />
          </Link>
          {isDemoMode ? (
            <span className="rounded-full border border-brand-teal-500/30 bg-brand-teal-100 px-2.5 py-1 text-xs font-semibold text-brand-teal-700">
              Data sintetis · DEMO
            </span>
          ) : null}
        </div>
      </header>

      <main
        id="konten"
        className="flex flex-1 items-center justify-center px-4 py-10"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <div className="mb-6 space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              Aktivasi akun
            </h1>
            <p className="text-sm leading-relaxed text-ink-muted">
              Buat kata sandi pribadi untuk mengaktifkan akun yang diberikan
              Master Admin. Tautan ini hanya berlaku sekali.
            </p>
          </div>

          {token ? (
            <ActivationForm token={token} />
          ) : (
            <div className="space-y-4">
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                Tautan aktivasi tidak lengkap. Minta tautan baru kepada Master
                Admin.
              </p>
              <Link
                href="/masuk"
                className="text-sm font-medium text-brand-blue-700 underline-offset-4 hover:underline"
              >
                Kembali ke halaman masuk
              </Link>
            </div>
          )}
        </div>
      </main>

      <SiteFooter compact />
    </div>
  );
}
