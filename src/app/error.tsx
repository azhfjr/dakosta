"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("DAKOSTA error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <main
      id="konten"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center"
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold tracking-wide text-danger uppercase">
          Terjadi kesalahan
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Permintaan tidak dapat diselesaikan
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Data Anda tidak diubah. Coba muat ulang halaman. Jika masalah berlanjut,
          kembali ke beranda dan masuk kembali.
        </p>
        {error.digest && (
          <p className="text-xs text-ink-muted">Kode kejadian: {error.digest}</p>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button className="h-11" onClick={reset}>
          Coba lagi
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href="/">Ke beranda</Link>
        </Button>
      </div>
    </main>
  );
}
