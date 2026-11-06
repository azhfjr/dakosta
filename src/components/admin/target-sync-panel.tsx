"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, Users } from "lucide-react";
import { toast } from "sonner";

import { isStepUpRequired, useStepUp } from "@/components/auth/step-up-dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumberId } from "@/lib/dates";
import type { TargetSyncSourcePreview } from "@/lib/targets/sync";

type SyncResult = {
  created: number;
  updated: number;
  perSource: Array<{
    label: string;
    targetCount: number;
    organizations: number;
    created: number;
    updated: number;
  }>;
};

export function TargetSyncPanel({
  month,
  sources,
  demo,
}: {
  month: string;
  sources: TargetSyncSourcePreview[];
  demo: boolean;
}) {
  const router = useRouter();
  const { prompt: promptStepUp, dialog: stepUpDialog } = useStepUp();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      sources.map((source) => [
        source.source,
        source.currentTarget === null ? "" : String(source.currentTarget),
      ]),
    ),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const entries = sources
    .map((source) => ({
      source: source.source,
      raw: values[source.source]?.trim() ?? "",
      preview: source,
    }))
    .filter((entry) => entry.raw.length > 0)
    .map((entry) => ({
      source: entry.source,
      targetCount: Number(entry.raw),
      preview: entry.preview,
    }));

  const invalid = entries.some(
    (entry) => !Number.isInteger(entry.targetCount) || entry.targetCount < 0,
  );

  function requestSync() {
    if (entries.length === 0) {
      toast.error("Isi target untuk minimal satu sumber input.");
      return;
    }
    if (invalid) {
      toast.error("Target harus berupa bilangan bulat 0 atau lebih.");
      return;
    }
    setConfirmOpen(true);
  }

  async function runSync() {
    async function attempt() {
      setBusy(true);
      try {
        const response = await fetch("/api/v1/admin/targets/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            month,
            entries: entries.map(({ source, targetCount }) => ({
              source,
              targetCount,
            })),
          }),
        });
        const body = (await response.json()) as {
          data?: SyncResult;
          error?: { code?: string; message?: string };
        };
        if (isStepUpRequired(response, body)) {
          promptStepUp(attempt);
          return;
        }
        if (!response.ok || !body.data) {
          toast.error(body.error?.message ?? "Sinkronisasi target gagal.");
          return;
        }
        setResult(body.data);
        setConfirmOpen(false);
        toast.success(
          `Sinkronisasi selesai: ${formatNumberId(body.data.created)} target baru, ${formatNumberId(body.data.updated)} diperbarui.`,
        );
        router.refresh();
      } catch {
        toast.error("Tidak dapat menghubungi server.");
      } finally {
        setBusy(false);
      }
    }
    await attempt();
  }

  if (sources.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">
          Sinkronisasi target semua organisasi
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Belum ada organisasi aktif yang dapat disinkronkan.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="target-sync-title"
      className="rounded-xl border border-brand-blue-600/25 bg-surface shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="target-sync-title"
            className="flex items-center gap-2 text-base font-semibold text-foreground"
          >
            <RefreshCcw className="size-4 text-brand-blue-600" aria-hidden />
            Sinkronisasi target semua organisasi
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Tetapkan satu target per sumber input untuk {month}. Target berlaku
            pada seluruh Faskes FKTP, Faskes FKRTL, Pemda, dan stakeholder aktif
            sesuai jenisnya.
          </p>
        </div>
        <p className="text-xs text-ink-muted">
          <Users className="mr-1 inline size-3.5" aria-hidden />
          {formatNumberId(
            sources.reduce(
              (sum, source) => sum + source.activeOrganizations,
              0,
            ),
          )}{" "}
          organisasi aktif
        </p>
      </div>

      <div className="grid gap-4 px-5 py-4 md:grid-cols-2 xl:grid-cols-4">
        {sources.map((source) => (
          <div key={source.source} className="space-y-1.5">
            <Label htmlFor={`sync-${source.source}`}>{source.label}</Label>
            <Input
              id={`sync-${source.source}`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder={
                source.currentTarget === null
                  ? "Belum seragam"
                  : "Target saat ini"
              }
              value={values[source.source] ?? ""}
              onChange={(event) =>
                setValues((state) => ({
                  ...state,
                  [source.source]: event.target.value,
                }))
              }
              className="h-10"
            />
            <p className="text-xs text-ink-muted">
              {formatNumberId(source.activeOrganizations)} organisasi ·{" "}
              {formatNumberId(source.withTarget)} sudah bertarget
              {source.missing > 0
                ? ` · ${formatNumberId(source.missing)} belum`
                : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
        <p className="text-xs text-ink-muted">
          {demo
            ? "Mode demo: sinkronisasi target dinonaktifkan agar data demo tetap terkendali."
            : "Kosongkan kolom untuk melewati sumber tersebut. Target per tema dan target manual tidak diubah."}
        </p>
        {demo ? null : (
          <Button
            type="button"
            className="h-10"
            onClick={requestSync}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Sinkronkan target
          </Button>
        )}
      </div>

      {result ? (
        <div
          role="status"
          className="border-t border-border bg-surface-muted/50 px-5 py-3 text-sm text-ink-muted"
        >
          <p className="font-medium text-foreground">
            Hasil sinkronisasi {month}: {formatNumberId(result.created)} dibuat,{" "}
            {formatNumberId(result.updated)} diperbarui.
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {result.perSource.map((source) => (
              <li key={source.label}>
                {source.label}: target {formatNumberId(source.targetCount)}{" "}
                untuk {formatNumberId(source.organizations)} organisasi ·{" "}
                {formatNumberId(source.created)} baru,{" "}
                {formatNumberId(source.updated)} diperbarui
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sinkronkan target periode ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Target akan diterapkan pada seluruh organisasi aktif sesuai sumber
              input. Target organisasi yang sudah ada akan diperbarui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-1 text-sm text-ink-muted">
            {entries.map((entry) => (
              <li key={entry.source}>
                {entry.preview.label}: target{" "}
                {formatNumberId(entry.targetCount)} untuk{" "}
                {formatNumberId(entry.preview.activeOrganizations)} organisasi
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void runSync();
              }}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Sinkronkan sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {stepUpDialog}
    </section>
  );
}
