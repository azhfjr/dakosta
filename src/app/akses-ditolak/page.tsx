import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Akses ditolak",
};

export default async function AccessDeniedPage() {
  const user = await getSessionUser();
  const homeHref = user ? (user.role === "ADMIN" ? "/admin" : "/client") : "/masuk";

  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted/60">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <BrandLogo variant="compact" className="w-32" />
          <span className="rounded-full border border-brand-teal-500/30 bg-brand-teal-100 px-2.5 py-1 text-xs font-semibold text-brand-teal-700">
            Data sintetis · DEMO
          </span>
        </div>
      </header>

      <main id="konten" className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-foreground">
            Akses ditolak
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Peran akun Anda tidak memiliki izin untuk membuka halaman ini.
            Percobaan akses dicatat pada jejak audit.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href={homeHref}>
                {user ? "Kembali ke ruang kerja" : "Masuk"}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/bantuan">Baca panduan akses</Link>
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter compact />
    </div>
  );
}
