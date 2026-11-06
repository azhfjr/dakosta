import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand/brand-logo";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SiteFooter } from "@/components/site-footer";
import { isDemoMode } from "@/lib/env";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Ganti kata sandi",
};

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/masuk");

  const redirectTo = user.homePath;
  const forced = user.mustChangePassword;

  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted/60">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <BrandLogo variant="compact" className="w-32" />
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
              Ganti kata sandi
            </h1>
            <p className="text-sm leading-relaxed text-ink-muted">
              {forced
                ? "Akun ini memakai kata sandi sementara. Buat kata sandi pribadi sebelum melanjutkan."
                : "Perbarui kata sandi akun Anda. Sesi lain akan diakhiri setelah kata sandi tersimpan."}
            </p>
          </div>
          <ChangePasswordForm
            email={user.email}
            redirectTo={redirectTo}
            forced={forced}
          />
        </div>
      </main>

      <SiteFooter compact />
    </div>
  );
}
