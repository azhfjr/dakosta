"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { isStepUpRequired, useStepUp } from "@/components/auth/step-up-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumberId } from "@/lib/dates";
import type {
  ContentImportCommitResult,
  ContentImportPreview,
} from "@/lib/imports/content";

export function ContentImportWizard({ readOnly = false }: { readOnly?: boolean }) {
  const router = useRouter();
  const { prompt: promptStepUp, dialog: stepUpDialog } = useStepUp();
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<ContentImportPreview | null>(null);
  const [result, setResult] = useState<ContentImportCommitResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function runPreview() {
    if (!file) {
      toast.error("Pilih berkas CSV terlebih dahulu.");
      return;
    }
    setBusy("preview");
    setResult(null);
    try {
      const text = await file.text();
      const response = await fetch("/api/v1/admin/imports/content/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, content: text }),
      });
      const body = (await response.json()) as {
        data?: ContentImportPreview;
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        toast.error(body.error?.message ?? "Pratinjau gagal.");
        return;
      }
      setContent(text);
      setPreview(body.data);
      toast.success("Pratinjau selesai. Periksa baris bermasalah.");
    } catch {
      toast.error("Tidak dapat membaca berkas atau menghubungi server.");
    } finally {
      setBusy(null);
    }
  }

  async function runCommit() {
    if (!preview) return;
    const current = preview;

    async function attempt() {
      setBusy("commit");
      try {
        const response = await fetch("/api/v1/admin/imports/content/commit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: current.filename,
            content,
            digest: current.digest,
          }),
        });
        const body = (await response.json()) as {
          data?: ContentImportCommitResult;
          error?: { code?: string; message?: string };
        };
        if (isStepUpRequired(response, body)) {
          promptStepUp(attempt);
          return;
        }
        if (!response.ok || !body.data) {
          toast.error(body.error?.message ?? "Impor konten gagal.");
          return;
        }
        setResult(body.data);
        setPreview(null);
        setConfirmOpen(false);
        toast.success(
          `${formatNumberId(body.data.created)} konten diimpor dan dikirim untuk validasi.`,
        );
        router.refresh();
      } catch {
        toast.error("Tidak dapat menghubungi server.");
      } finally {
        setBusy(null);
      }
    }

    await attempt();
  }

  if (readOnly) {
    return (
      <p
        role="status"
        className="rounded-xl border border-brand-blue-500/25 bg-brand-blue-100/40 px-4 py-3 text-sm text-brand-blue-900"
      >
        Mode demo: impor konten dinonaktifkan agar data demo tetap terkendali.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <FileUp className="size-4 text-brand-blue-700" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            Unggah berkas konten
          </h2>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Format CSV, maksimal 1 MB dan 200 baris per unggahan. Konten valid
          langsung dikirim ke antrean validasi cabang dengan status{" "}
          <strong className="text-foreground">Diajukan</strong>.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="h-10">
            <a href="/api/v1/admin/imports/content/template">Unduh template</a>
          </Button>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-input bg-background px-3 text-sm">
            <Upload className="mr-2 size-4" aria-hidden />
            {file ? file.name : "Pilih berkas CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setResult(null);
              }}
            />
          </label>
          <Button
            type="button"
            className="h-10"
            disabled={busy !== null || !file}
            onClick={runPreview}
          >
            {busy === "preview" ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : null}
            Pratinjau & validasi
          </Button>
        </div>
      </section>

      {preview ? (
        <section className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Hasil validasi
              </h2>
              <p className="text-xs text-ink-muted">
                {formatNumberId(preview.validCount)} valid ·{" "}
                {formatNumberId(preview.errorCount)} bermasalah ·{" "}
                {formatNumberId(preview.rowCount)} baris
              </p>
            </div>
            <Button
              type="button"
              className="h-10"
              disabled={busy !== null || preview.validCount === 0}
              onClick={() => setConfirmOpen(true)}
            >
              Impor {formatNumberId(preview.validCount)} konten
            </Button>
          </div>
          <div className="relative max-h-[32rem] overflow-auto">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <caption className="sr-only">Pratinjau impor konten</caption>
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-2.5">Baris</th>
                  <th scope="col" className="px-4 py-2.5">Organisasi</th>
                  <th scope="col" className="px-4 py-2.5">Judul</th>
                  <th scope="col" className="px-4 py-2.5">Jenis</th>
                  <th scope="col" className="px-4 py-2.5">Tema</th>
                  <th scope="col" className="px-4 py-2.5">Tanggal</th>
                  <th scope="col" className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className="border-b border-border/70 align-top last:border-0"
                  >
                    <td className="px-4 py-2.5 text-ink-muted tabular">{row.rowNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {row.organizationName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">
                      {row.title ?? "(tanpa judul)"}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{row.contentType ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{row.subTheme ?? "—"}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{row.dateCreated ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          row.status === "VALID"
                            ? "inline-flex rounded-full bg-status-approved/10 px-2 py-0.5 text-xs font-medium text-status-approved"
                            : "inline-flex rounded-full bg-status-rejected/10 px-2 py-0.5 text-xs font-medium text-status-rejected"
                        }
                      >
                        {row.status === "VALID" ? "Valid" : "Bermasalah"}
                      </span>
                      {row.errors.length > 0 ? (
                        <ul className="mt-1 list-disc pl-4 text-xs text-ink-muted">
                          {row.errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {result ? (
        <section
          role="status"
          className="rounded-xl border border-status-approved/30 bg-status-approved/5 p-4"
        >
          <h2 className="text-base font-semibold text-foreground">
            Impor selesai
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {formatNumberId(result.created)} konten dibuat dan dikirim untuk
            validasi
            {result.failed > 0
              ? ` · ${formatNumberId(result.failed)} baris gagal`
              : ""}
            .
          </p>
          <ul className="mt-2 max-h-64 overflow-auto text-xs text-ink-muted">
            {result.rows.map((row) => (
              <li key={row.rowNumber}>
                Baris {row.rowNumber} · {row.organizationName ?? "—"} ·{" "}
                {row.status === "CREATED"
                  ? row.referenceCode
                  : (row.error ?? "Gagal")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Impor konten sekarang?</DialogTitle>
            <DialogDescription>
              {preview
                ? `${formatNumberId(preview.validCount)} konten akan dibuat dan langsung dikirim ke antrean validasi cabang. Tindakan ini memerlukan konfirmasi kata sandi.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => setConfirmOpen(false)}
              disabled={busy === "commit"}
            >
              Batal
            </Button>
            <Button
              type="button"
              className="h-10"
              disabled={busy === "commit"}
              onClick={() => void runCommit()}
            >
              {busy === "commit" ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              Impor konten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {stepUpDialog}
    </div>
  );
}
