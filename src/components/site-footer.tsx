import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { isDemoMode } from "@/lib/env";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className="border-t border-border bg-surface-muted/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo variant="compact" decorative className="w-28" />
          </div>
          <nav aria-label="Tautan footer" className="flex flex-wrap gap-4 text-sm">
            <Link className="text-ink-muted hover:text-foreground" href="/tentang">
              Tentang &amp; Disclaimer
            </Link>
            <Link className="text-ink-muted hover:text-foreground" href="/bantuan">
              Bantuan
            </Link>
          </nav>
        </div>
        <p
          className={
            compact
              ? "max-w-4xl text-xs leading-relaxed text-ink-muted"
              : "max-w-4xl text-sm leading-relaxed text-ink-muted"
          }
        >
          DAKOSTA — Proyek independen oleh Ratu Sevilla Hizriyah. Tidak
          berafiliasi dengan atau mewakili BPJS Kesehatan.
          {isDemoMode
            ? " Seluruh data pada mode demo bersifat sintetis dan berlabel DEMO."
            : " Tidak ada data pribadi peserta, NIK, atau nomor JKN."}
        </p>
      </div>
    </footer>
  );
}
