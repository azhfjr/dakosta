"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WorkspaceError({
  error,
  reset,
  scope,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  scope: string;
}) {
  useEffect(() => {
    console.error(`DAKOSTA error (${scope})`, error.digest ?? "no-digest");
  }, [error, scope]);

  return (
    <div className="mx-auto w-full max-w-3xl px-1 py-10">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-danger" aria-hidden />
          <div className="space-y-2">
            <p className="text-sm font-semibold tracking-wide text-danger uppercase">
              {scope} tidak dapat dimuat
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Sebagian data gagal diambil
            </h1>
            <p className="text-sm leading-relaxed text-ink-muted">
              Tidak ada data yang diubah. Muat ulang bagian ini; bila masih
              gagal, periksa koneksi lalu coba lagi beberapa saat lagi.
            </p>
            {error.digest ? (
              <p className="text-xs text-ink-muted">
                Kode kejadian: {error.digest}
              </p>
            ) : null}
            <div className="pt-2">
              <Button className="h-10" onClick={reset}>
                Muat ulang bagian ini
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
