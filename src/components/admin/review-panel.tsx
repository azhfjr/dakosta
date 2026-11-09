"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Check, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewAction } from "@/lib/review";

type ChecklistKey =
  "relevansiTema" | "akurasiKonten" | "kelengkapanTautan" | "etikaDanPrivasi";

const CHECKLIST_ITEMS: Array<{
  key: ChecklistKey;
  label: string;
  hint: string;
}> = [
  {
    key: "relevansiTema",
    label: "Relevan dengan tema",
    hint: "Isi konten sesuai tema yang dipilih pelapor.",
  },
  {
    key: "akurasiKonten",
    label: "Isi akurat",
    hint: "Tidak menyesatkan dan tidak memuat klaim yang belum terverifikasi.",
  },
  {
    key: "kelengkapanTautan",
    label: "Tautan lengkap",
    hint: "Tautan publik, memakai https, dan dapat diakses.",
  },
  {
    key: "etikaDanPrivasi",
    label: "Etika & privasi",
    hint: "Tidak memuat data pribadi, nomor identitas, atau rekam medis.",
  },
];

const ACTION_COPY: Record<
  ReviewAction,
  {
    label: string;
    title: string;
    description: string;
    confirm: string;
    variant: "default" | "outline" | "destructive";
  }
> = {
  APPROVE: {
    label: "Setujui",
    title: "Setujui konten ini?",
    description:
      "Konten akan berstatus Disetujui dan langsung dihitung dalam capaian. Keputusan tercatat pada audit dan notifikasi pelapor.",
    confirm: "Ya, setujui",
    variant: "default",
  },
  REQUEST_REVISION: {
    label: "Minta revisi",
    title: "Minta revisi konten ini?",
    description:
      "Pelapor dapat memperbaiki konten lalu mengirim ulang. Konten belum dihitung sebagai capaian.",
    confirm: "Ya, minta revisi",
    variant: "outline",
  },
  REJECT: {
    label: "Tolak",
    title: "Kembalikan konten sebagai Perlu Revisi?",
    description:
      "Konten dikembalikan sebagai Perlu Revisi, belum dihitung sebagai capaian, dan pelapor dapat memperbaiki lalu mengirim ulang. Alasan penolakan diteruskan ke pelapor.",
    confirm: "Ya, tolak",
    variant: "destructive",
  },
};

type ConflictDetails = {
  currentStatus?: string;
  currentVersion?: number;
  referenceCode?: string;
};

export function ReviewPanel({
  submissionId,
  expectedVersion,
  canReview,
  decidedStatus,
  basePath = "/admin/validasi",
}: {
  submissionId: string;
  expectedVersion: number;
  canReview: boolean;
  decidedStatus: string;
  basePath?: string;
}) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>({
    relevansiTema: false,
    akurasiKonten: false,
    kelengkapanTautan: false,
    etikaDanPrivasi: false,
  });
  const [notes, setNotes] = useState("");
  const [conflictOfInterest, setConflictOfInterest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictDetails | null>(null);
  const [submitting, setSubmitting] = useState<ReviewAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<ReviewAction | null>(null);

  function toggle(key: ChecklistKey) {
    setChecklist((current) => ({ ...current, [key]: !current[key] }));
    setError(null);
  }

  function requestDecision(action: ReviewAction) {
    setError(null);

    if (action === "APPROVE" && !Object.values(checklist).every(Boolean)) {
      setError("Centang seluruh checklist sebelum menyetujui konten.");
      return;
    }
    if (action !== "APPROVE" && notes.trim().length < 10) {
      setError("Tuliskan alasan minimal 10 karakter untuk keputusan ini.");
      return;
    }

    setConfirmAction(action);
  }

  async function submitDecision(action: ReviewAction) {
    setSubmitting(action);
    setError(null);
    setConflict(null);

    try {
      const response = await fetch("/api/v1/admin/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submissionId,
          expectedVersion,
          action,
          checklist,
          notes: notes.trim() || undefined,
          conflictOfInterest,
        }),
      });

      const body = (await response.json()) as {
        error?: { code?: string; message?: string; details?: ConflictDetails };
      };

      if (!response.ok) {
        if (response.status === 409) {
          setConflict(body.error?.details ?? null);
        }
        setError(body.error?.message ?? "Keputusan tidak dapat disimpan.");
        setConfirmAction(null);
        return;
      }

      toast.success("Keputusan tersimpan dan pelapor telah dinotifikasi.");
      setConfirmAction(null);
      router.push(basePath);
      router.refresh();
    } catch {
      setError(
        "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.",
      );
      setConfirmAction(null);
    } finally {
      setSubmitting(null);
    }
  }

  if (!canReview) {
    return (
      <section
        aria-labelledby="review-panel-title"
        className="rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        <h2
          id="review-panel-title"
          className="text-base font-semibold text-foreground"
        >
          Keputusan validasi
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Konten ini sudah diputuskan dengan status{" "}
          <span className="font-medium text-foreground">{decidedStatus}</span>.
          Keputusan baru hanya dapat dilakukan pada konten berstatus Terkirim.
        </p>
        <Button asChild variant="outline" className="mt-4 h-11">
          <Link href={basePath}>Kembali ke antrean</Link>
        </Button>
      </section>
    );
  }

  const copy = confirmAction ? ACTION_COPY[confirmAction] : null;

  return (
    <section
      aria-labelledby="review-panel-title"
      className="rounded-xl border border-border bg-surface shadow-sm xl:sticky xl:top-6"
    >
      <div className="border-b border-border px-5 py-4">
        <h2
          id="review-panel-title"
          className="text-base font-semibold text-foreground"
        >
          Keputusan validasi
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Versi {expectedVersion}. Keputusan menulis ulasan, notifikasi, dan
          audit dalam satu transaksi.
        </p>
      </div>

      <div className="space-y-5 px-5 py-5">
        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            Checklist validasi
          </legend>
          <ul className="mt-3 space-y-3">
            {CHECKLIST_ITEMS.map((item) => (
              <li key={item.key}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`checklist-${item.key}`}
                    checked={checklist[item.key]}
                    onCheckedChange={() => toggle(item.key)}
                    disabled={submitting !== null}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <Label
                      htmlFor={`checklist-${item.key}`}
                      className="text-sm font-medium"
                    >
                      {item.label}
                    </Label>
                    <p className="text-xs leading-relaxed text-ink-muted">
                      {item.hint}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="review-notes">Catatan keputusan</Label>
          <Textarea
            id="review-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Wajib untuk permintaan revisi atau penolakan."
            maxLength={2000}
            disabled={submitting !== null}
            aria-describedby="review-notes-help"
          />
          <p id="review-notes-help" className="text-xs text-ink-muted">
            {notes.trim().length}/2000 karakter. Catatan diteruskan ke pelapor.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted/60 p-3">
          <Checkbox
            id="review-conflict"
            checked={conflictOfInterest}
            onCheckedChange={(checked) =>
              setConflictOfInterest(checked === true)
            }
            disabled={submitting !== null}
            className="mt-0.5"
          />
          <Label
            htmlFor="review-conflict"
            className="text-xs leading-relaxed text-ink-muted"
          >
            Saya memiliki potensi konflik kepentingan dengan konten ini dan
            menandainya untuk transparansi audit.
          </Label>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-status-rejected/30 bg-status-rejected/10 p-3 text-sm text-status-rejected"
          >
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
            {conflict ? (
              <div className="mt-2 space-y-2 pl-6 text-xs text-ink-muted">
                <p>
                  Status saat ini: {conflict.currentStatus ?? "tidak diketahui"}{" "}
                  · versi {conflict.currentVersion ?? "—"}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={() => router.refresh()}
                >
                  <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
                  Muat ulang data
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2">
          <Button
            type="button"
            className="h-11 w-full"
            onClick={() => requestDecision("APPROVE")}
            disabled={submitting !== null}
          >
            {submitting === "APPROVE" ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="mr-2 size-4" aria-hidden />
            )}
            Setujui konten
          </Button>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => requestDecision("REQUEST_REVISION")}
              disabled={submitting !== null}
            >
              {submitting === "REQUEST_REVISION" ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <RotateCcw className="mr-2 size-4" aria-hidden />
              )}
              Minta revisi
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={() => requestDecision("REJECT")}
              disabled={submitting !== null}
            >
              {submitting === "REJECT" ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <X className="mr-2 size-4" aria-hidden />
              )}
              Tolak
            </Button>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-ink-muted">
          Hanya konten berstatus Disetujui yang dihitung dalam capaian.
          Keputusan admin selalu dapat ditelusuri melalui jejak audit.
        </p>
      </div>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open && submitting === null) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {notes.trim() ? (
            <p className="rounded-lg border border-border bg-surface-muted p-3 text-sm text-ink">
              <span className="font-medium">Catatan: </span>
              {notes.trim()}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting !== null}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant={copy?.variant ?? "default"}
              disabled={submitting !== null}
              onClick={(event) => {
                event.preventDefault();
                if (confirmAction) void submitDecision(confirmAction);
              }}
            >
              {submitting !== null ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              {copy?.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
