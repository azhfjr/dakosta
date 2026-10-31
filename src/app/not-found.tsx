import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="konten"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center"
    >
      <BrandLogo className="w-52" />
      <div className="space-y-2">
        <p className="text-sm font-semibold tracking-wide text-brand-teal-700 uppercase">
          Halaman tidak ditemukan
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Tautan ini tidak tersedia
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Halaman mungkin sudah dipindahkan atau tidak tersedia untuk peran
          akun Anda. Kembali ke beranda atau masuk ke ruang kerja.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild className="h-11">
          <Link href="/">Ke beranda</Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href="/masuk">Masuk</Link>
        </Button>
      </div>
      <p className="text-xs text-ink-muted">
        DAKOSTA — proyek demonstrasi pribadi, tidak berafiliasi dengan BPJS
        Kesehatan.
      </p>
    </main>
  );
}
