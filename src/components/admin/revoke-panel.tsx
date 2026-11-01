"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { isStepUpRequired, useStepUp } from "@/components/auth/step-up-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RevokePanel({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const { prompt: promptStepUp, dialog: stepUpDialog } = useStepUp();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    if (reason.trim().length < 10) {
      setError("Tuliskan alasan pencabutan minimal 10 karakter.");
      return;
    }
    async function attempt() {
      setPending(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/v1/admin/contents/${submissionId}/revoke`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ reason: reason.trim() }),
          },
        );
        const body = (await response.json().catch(() => null)) as {
          error?: { code?: string; message?: string };
        } | null;
        if (isStepUpRequired(response, body)) {
          promptStepUp(attempt);
          return;
        }
        if (!response.ok) {
          setError(body?.error?.message ?? "Konten tidak dapat dicabut.");
          return;
        }
        toast.success("Konten dicabut. Capaian dihitung ulang otomatis.");
        setConfirming(false);
        router.refresh();
      } catch {
        setError(
          "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.",
        );
      } finally {
        setPending(false);
      }
    }
    await attempt();
  }

  return (
    <section
      aria-labelledby="revoke-panel-title"
      className="rounded-xl border border-status-rejected/30 bg-surface p-5 shadow-sm"
    >
      <h2
        id="revoke-panel-title"
        className="flex items-center gap-2 text-base font-semibold text-foreground"
      >
        <ShieldOff className="size-4 text-status-rejected" aria-hidden />
        Pencabutan Master Admin
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Pencabutan hanya berlaku untuk konten berstatus Disetujui. Riwayat
        ulasan tetap tersimpan, capaian langsung dihitung ulang, dan pelapor
        dinotifikasi.
      </p>

      <div className="mt-4 space-y-2">
        <Label htmlFor="revoke-reason">Alasan pencabutan</Label>
        <Textarea
          id="revoke-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={2000}
          disabled={pending}
          placeholder="Contoh: tautan tidak lagi dapat diakses publik."
        />
        <p className="text-xs text-ink-muted">
          {reason.trim().length}/2000 karakter
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-2 flex items-start gap-2 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="mt-4 rounded-lg border border-status-rejected/30 bg-status-rejected/5 p-3">
          <p className="text-sm text-foreground">
            Cabut konten ini? Tindakan tercatat permanen pada audit.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={revoke}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              Ya, cabut konten
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="mt-4 h-11"
          onClick={() => setConfirming(true)}
        >
          <ShieldOff className="mr-2 size-4" aria-hidden />
          Cabut persetujuan
        </Button>
      )}
      {stepUpDialog}
    </section>
  );
}
