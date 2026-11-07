"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { isStepUpRequired, useStepUp } from "@/components/auth/step-up-dialog";
import { Button } from "@/components/ui/button";
import { formatNumberId } from "@/lib/dates";
import type { ImportPreview } from "@/lib/imports/accounts";

type CommitResult = {
  importId: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  credentials: Array<{
    rowNumber: number;
    name: string;
    email: string;
    activationUrl: string;
  }>;
};

function downloadActivationCsv(result: CommitResult) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = [
    ["nama", "email", "tautan_aktivasi"],
    ...result.credentials.map((row) => [
      row.name,
      row.email,
      row.activationUrl,
    ]),
  ];
  const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "tautan-aktivasi.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function CopyAll({ result }: { result: CommitResult }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-9"
      onClick={async () => {
        const text = result.credentials
          .map((row) => `${row.name}\t${row.email}\t${row.activationUrl}`)
          .join("\n");
        await navigator.clipboard.writeText(text).catch(() => undefined);
        toast.success("Tautan aktivasi disalin.");
      }}
    >
      <CheckCircle2 className="mr-1.5 size-4" aria-hidden />
      Salin tautan
    </Button>
  );
}

const ROW_STATUS_LABEL: Record<string, string> = {
  VALID: "Valid",
  INVALID: "Bermasalah",
  CONFLICT: "Konflik",
  SKIPPED: "Dilewati",
  CREATED: "Dibuat",
  UPDATED: "Diperbarui",
  FAILED: "Gagal",
};

function badgeClass(status: string): string {
  const base =
    "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  if (status === "VALID" || status === "CREATED" || status === "UPDATED") {
    return `${base} border-status-approved/25 bg-status-approved/10 text-status-approved`;
  }
  if (status === "CONFLICT" || status === "SKIPPED") {
    return `${base} border-status-review/30 bg-status-review/10 text-status-review`;
  }
  return `${base} border-status-rejected/30 bg-status-rejected/10 text-status-rejected`;
}

export function ImportWizard({ readOnly = false }: { readOnly?: boolean }) {
  const router = useRouter();
  const { prompt: promptStepUp, dialog: stepUpDialog } = useStepUp();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [policy, setPolicy] = useState<"skip" | "update" | "upsert">("skip");

  async function runPreview() {
    if (!file) {
      toast.error("Pilih berkas CSV terlebih dahulu.");
      return;
    }
    setBusy("preview");
    setResult(null);
    try {
      const content = await file.text();
      const response = await fetch("/api/v1/admin/imports/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, content, policy }),
      });
      const body = (await response.json()) as {
        data?: ImportPreview;
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        toast.error(body.error?.message ?? "Pratinjau gagal.");
        return;
      }
      setPreview(body.data);
      toast.success("Pratinjau selesai. Periksa baris tidak valid.");
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
        const response = await fetch("/api/v1/admin/imports/commit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ importId: current.importId }),
        });
        const body = (await response.json()) as {
          data?: CommitResult;
          error?: { code?: string; message?: string };
        };
        if (isStepUpRequired(response, body)) {
          promptStepUp(attempt);
          return;
        }
        if (!response.ok || !body.data) {
          toast.error(body.error?.message ?? "Eksekusi impor gagal.");
          return;
        }
        setResult(body.data);
        setPreview(null);
        toast.success(
          `${body.data.created} akun dibuat, ${body.data.updated} diperbarui.`,
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
        Mode demo: impor akun dinonaktifkan. Riwayat impor tetap dapat dilihat.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <FileUp className="size-4 text-brand-blue-700" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            Unggah berkas akun
          </h2>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Format CSV, maksimal 1 MB dan 1.000 baris. Tidak ada kolom kata sandi;
          setiap akun memperoleh tautan aktivasi sekali pakai. Baris
          MASTER_ADMIN ditolak.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="h-10">
            <a href="/api/v1/admin/imports/template?kind=account">
              Unduh template
            </a>
          </Button>
          <Button asChild variant="ghost" className="h-10">
            <a href="/api/v1/admin/imports/example?kind=account">
              Unduh contoh
            </a>
          </Button>
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <span>Jika email sudah ada</span>
            <select
              className="h-10 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
              value={policy}
              onChange={(event) => {
                setPolicy(event.target.value as typeof policy);
                setPreview(null);
              }}
            >
              <option value="skip">Lewati</option>
              <option value="update">Perbarui data</option>
              <option value="upsert">Buat atau perbarui</option>
            </select>
          </label>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-input bg-background px-3 text-sm">
            <Upload className="mr-2 size-4" aria-hidden />
            {file ? file.name : "Pilih berkas CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                setPreview(null);
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
                {formatNumberId(preview.validCount)} siap dibuat ·{" "}
                {formatNumberId(preview.conflictCount)} konflik ·{" "}
                {formatNumberId(preview.errorCount)} bermasalah · digest{" "}
                {preview.digest.slice(0, 12)}…
              </p>
              <p className="text-xs text-ink-muted">
                Kebijakan email ganda:{" "}
                {preview.policy === "skip"
                  ? "lewati"
                  : preview.policy === "update"
                    ? "perbarui data akun"
                    : "buat atau perbarui"}
                .
              </p>
            </div>
            <Button
              type="button"
              className="h-10"
              disabled={
                busy !== null ||
                preview.validCount + preview.conflictCount === 0
              }
              onClick={runCommit}
            >
              {busy === "commit" ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              Eksekusi{" "}
              {formatNumberId(preview.validCount + preview.conflictCount)} baris
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">Hasil validasi baris impor</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    Baris
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Nama
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Peran
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className="border-b border-border/70 align-top last:border-0"
                  >
                    <td className="px-4 py-3 tabular-nums text-ink-muted">
                      {row.rowNumber}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {row.normalized?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {row.normalized?.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {row.normalized?.role ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={badgeClass(row.status)}>
                        {ROW_STATUS_LABEL[row.status] ?? row.status}
                      </span>
                      {row.errors && row.errors.length > 0 ? (
                        <ul className="mt-1 list-disc pl-4 text-xs text-status-rejected">
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
        <section className="rounded-xl border border-status-approved/30 bg-status-approved/5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-status-approved/20 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Impor selesai
              </h2>
              <p className="text-xs text-ink-muted">
                {formatNumberId(result.created)} dibuat ·{" "}
                {formatNumberId(result.updated)} diperbarui ·{" "}
                {formatNumberId(result.skipped)} dilewati ·{" "}
                {formatNumberId(result.failed)} gagal
              </p>
            </div>
            <CopyAll result={result} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => downloadActivationCsv(result)}
            >
              <Upload className="mr-1.5 size-4" aria-hidden />
              Unduh CSV tautan
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">Tautan aktivasi akun baru</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    Nama
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Tautan aktivasi
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.credentials.map((row) => (
                  <tr
                    key={row.email}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-4 py-3 text-foreground">{row.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{row.email}</td>
                    <td className="px-4 py-3 font-mono text-xs break-all">
                      {row.activationUrl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-ink-muted">
            Tautan berlaku 48 jam dan hanya sekali pakai. Tautan tidak dicatat
            pada audit, log, atau CSV hasil impor.
          </p>
        </section>
      ) : null}
      {stepUpDialog}
    </div>
  );
}
