import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActivationForm } from "@/components/activation/activation-form";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteFooter } from "@/components/site-footer";
import { getActivationSummary } from "@/lib/activation";
import { requireAuth } from "@/lib/authz/guards";
import { isDemoMode } from "@/lib/env";
import { toSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Aktivasi lokasi",
};

export const dynamic = "force-dynamic";

export default async function ActivationPage() {
  const ctx = await requireAuth({
    allowPasswordChangePending: false,
    allowPendingLocation: true,
  });
  if (ctx.role === "MASTER_ADMIN") redirect(ctx.homePath);
  if (ctx.locationStatus === "VERIFIED" || ctx.locationStatus === "EXEMPT") {
    redirect(ctx.homePath);
  }

  const user = toSessionUser(ctx);
  const summary = await getActivationSummary(ctx.userId);

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
        <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <div className="mb-6 space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              Aktivasi lokasi perangkat
            </h1>
            <p className="text-sm leading-relaxed text-ink-muted">
              Halo {user.name}. Sebelum memakai DAKOSTA, aktifkan lokasi
              perangkat satu kali. Proses ini tidak meminta lokasi pada setiap
              konten.
            </p>
            {summary.status === "GRACE" && summary.graceDeadline ? (
              <p className="rounded-lg border border-status-review/30 bg-status-review/5 px-3 py-2 text-sm text-ink-muted">
                Akun lama Anda masih dalam masa tenggang sampai{" "}
                {new Intl.DateTimeFormat("id-ID", {
                  dateStyle: "long",
                  timeZone: "Asia/Jakarta",
                }).format(summary.graceDeadline)}{" "}
                WIB. Setelah itu aktivasi wajib diselesaikan.
              </p>
            ) : null}
          </div>
          <ActivationForm homePath={user.homePath} />
        </div>
      </main>

      <SiteFooter compact />
    </div>
  );
}
