"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  History,
  Loader2,
  Play,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { isStepUpRequired, useStepUp } from "@/components/auth/step-up-dialog";
import { Button } from "@/components/ui/button";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import {
  SYNC_STAGE_LABELS,
  type SyncJobView,
  type SyncStatus,
} from "@/lib/sync/shared";

const STATUS_LABEL: Record<SyncStatus, string> = {
  QUEUED: "Menunggu",
  RUNNING: "Berjalan",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
  PARTIAL: "Sebagian",
  CANCELLED: "Dibatalkan",
};

function statusClass(status: SyncStatus): string {
  switch (status) {
    case "COMPLETED":
      return "border-status-approved/25 bg-status-approved/10 text-status-approved";
    case "RUNNING":
    case "QUEUED":
      return "border-brand-blue-500/25 bg-brand-blue-100/50 text-brand-blue-900";
    case "PARTIAL":
      return "border-status-revision/30 bg-status-revision/10 text-status-revision";
    case "FAILED":
      return "border-status-rejected/30 bg-status-rejected/10 text-status-rejected";
    default:
      return "border-border bg-surface-muted text-ink-muted";
  }
}

function isActive(job: SyncJobView): boolean {
  return job.status === "QUEUED" || job.status === "RUNNING";
}

function formatDuration(job: SyncJobView): string {
  if (!job.startedAt) return "—";
  const end = job.finishedAt ? new Date(job.finishedAt) : new Date();
  const seconds = Math.max(
    0,
    Math.round((end.getTime() - new Date(job.startedAt).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds} dtk`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} mnt ${seconds % 60} dtk`;
}

export function SyncPanel({
  initialJobs,
  readOnly,
}: {
  initialJobs: SyncJobView[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const { prompt: promptStepUp, dialog: stepUpDialog } = useStepUp();
  const [jobs, setJobs] = useState(initialJobs);
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);

  const activeJob = jobs.find(isActive) ?? null;
  const activeJobId = activeJob?.id ?? null;
  const latest = jobs[0] ?? null;

  useEffect(() => {
    if (!activeJobId) return;
    const jobId = activeJobId;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/admin/sync/${jobId}`, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const body = (await response.json()) as { data?: SyncJobView };
        if (!body.data) return;
        const updated = body.data;
        setJobs((current) =>
          current.map((job) => (job.id === updated.id ? updated : job)),
        );
        if (!isActive(updated)) router.refresh();
      } catch {
        // Polling is best effort; the next tick retries.
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [activeJobId, router]);

  async function startJob() {
    async function attempt() {
      setBusy(true);
      try {
        const response = await fetch("/api/v1/admin/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dryRun }),
        });
        const body = (await response.json()) as {
          data?: SyncJobView;
          error?: { code?: string; message?: string };
        };
        if (isStepUpRequired(response, body)) {
          promptStepUp(attempt);
          return;
        }
        if (!response.ok || !body.data) {
          toast.error(
            body.error?.message ?? "Sinkronisasi tidak dapat dimulai.",
          );
          return;
        }
        setJobs((current) => [body.data!, ...current]);
        toast.success(
          body.data.dryRun
            ? "Sinkronisasi uji (dry-run) dimulai."
            : "Sinkronisasi dimulai.",
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

  async function cancelJob(job: SyncJobView) {
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/admin/sync/${job.id}/cancel`, {
        method: "POST",
      });
      const body = (await response.json()) as {
        data?: SyncJobView;
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        toast.error(body.error?.message ?? "Pembatalan gagal.");
        return;
      }
      setJobs((current) =>
        current.map((item) => (item.id === job.id ? body.data! : item)),
      );
      toast.success("Permintaan pembatalan dikirim.");
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  async function retryJob(job: SyncJobView) {
    async function attempt() {
      setBusy(true);
      try {
        const response = await fetch(`/api/v1/admin/sync/${job.id}/retry`, {
          method: "POST",
        });
        const body = (await response.json()) as {
          data?: SyncJobView;
          error?: { code?: string; message?: string };
        };
        if (isStepUpRequired(response, body)) {
          promptStepUp(attempt);
          return;
        }
        if (!response.ok || !body.data) {
          toast.error(body.error?.message ?? "Pekerjaan tidak dapat diulang.");
          return;
        }
        setJobs((current) => [body.data!, ...current]);
        toast.success("Pekerjaan baru dijadwalkan.");
        router.refresh();
      } catch {
        toast.error("Tidak dapat menghubungi server.");
      } finally {
        setBusy(false);
      }
    }
    await attempt();
  }

  const active = activeJob ?? latest;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="sync-start-title"
        className="rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        <h2
          id="sync-start-title"
          className="flex items-center gap-2 text-base font-semibold text-foreground"
        >
          <RefreshCcw className="size-4 text-brand-blue-600" aria-hidden />
          Jalankan sinkronisasi internal
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Sinkronisasi memeriksa cakupan konten, invarian persetujuan,
          rekonsiliasi target, cache, outbox notifikasi, dan agregat analitik.
          Dry-run adalah default dan tidak mengubah data.
        </p>

        {readOnly ? (
          <p
            role="status"
            className="mt-4 rounded-lg border border-brand-blue-500/25 bg-brand-blue-100/40 px-4 py-3 text-sm text-brand-blue-900"
          >
            Mode demo: sinkronisasi dinonaktifkan. Riwayat pekerjaan tetap dapat
            dilihat.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={dryRun}
                onChange={(event) => setDryRun(event.target.checked)}
                disabled={busy || activeJob !== null}
              />
              Dry-run (tidak mengubah data)
            </label>
            <Button
              type="button"
              className="h-10"
              onClick={() => void startJob()}
              disabled={busy || activeJob !== null}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Play className="size-4" aria-hidden />
              )}
              Mulai sinkronisasi
            </Button>
            {activeJob ? (
              <span className="text-xs text-ink-muted">
                Satu pekerjaan sejenis berjalan; mulai lagi setelah selesai.
              </span>
            ) : null}
          </div>
        )}
      </section>

      {active ? (
        <section
          aria-labelledby="sync-progress-title"
          className="rounded-xl border border-border bg-surface p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="sync-progress-title"
                className="text-base font-semibold text-foreground"
              >
                Progres pekerjaan
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                {formatDateTimeId(new Date(active.createdAt))} ·{" "}
                {active.dryRun ? "Dry-run" : "Terapkan"} · durasi{" "}
                {formatDuration(active)}
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass(active.status)}`}
            >
              {STATUS_LABEL[active.status]}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>
                Tahap: {SYNC_STAGE_LABELS[active.stage] ?? active.stage}
              </span>
              <span className="tabular-nums">
                {formatNumberId(active.processed)} /{" "}
                {active.total === null
                  ? "menghitung…"
                  : formatNumberId(active.total)}{" "}
                unit
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Progres sinkronisasi"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={active.percent ?? 0}
              aria-valuetext={`${active.percent ?? 0}%`}
              className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
            >
              <div
                className="h-full rounded-full bg-brand-blue-600 transition-[width] duration-500"
                style={{ width: `${active.percent ?? 0}%` }}
              />
            </div>
          </div>

          {active.error ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-status-rejected/30 bg-status-rejected/10 px-3 py-2 text-sm text-status-rejected"
            >
              {active.error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {readOnly ? null : (
              <>
                {isActive(active) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    disabled={busy || active.cancelRequested}
                    onClick={() => void cancelJob(active)}
                  >
                    <Ban className="size-4" aria-hidden />
                    {active.cancelRequested ? "Pembatalan diminta" : "Batalkan"}
                  </Button>
                ) : null}
                {["FAILED", "PARTIAL", "CANCELLED"].includes(active.status) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    disabled={busy}
                    onClick={() => void retryJob(active)}
                  >
                    <RefreshCcw className="size-4" aria-hidden />
                    Jalankan ulang
                  </Button>
                ) : null}
              </>
            )}
          </div>

          {active.summary ? (
            <div className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck
                  className="size-4 text-brand-blue-600"
                  aria-hidden
                />
                Ringkasan tahap
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <caption className="sr-only">
                    Ringkasan hasil per tahap sinkronisasi
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                      <th scope="col" className="py-2 pr-4">
                        Tahap
                      </th>
                      <th scope="col" className="py-2 pr-4 text-right">
                        Diperiksa
                      </th>
                      <th scope="col" className="py-2 pr-4 text-right">
                        Temuan
                      </th>
                      <th scope="col" className="py-2 text-right">
                        Diperbaiki
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.summary.stages.map((stage) => (
                      <tr
                        key={stage.stage}
                        className="border-b border-border/70 align-top last:border-0"
                      >
                        <td className="py-2 pr-4">
                          <p className="font-medium text-foreground">
                            {stage.label}
                          </p>
                          {stage.notes.length > 0 ? (
                            <ul className="mt-1 list-disc pl-4 text-xs text-ink-muted">
                              {stage.notes.map((note) => (
                                <li key={note}>{note}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-ink-muted">
                          {formatNumberId(stage.scanned)}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-ink-muted">
                          {formatNumberId(stage.findings)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-ink-muted">
                          {formatNumberId(stage.fixed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                {active.summary.externalNote}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section
        aria-labelledby="sync-history-title"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <History className="size-4 text-ink-muted" aria-hidden />
          <h2
            id="sync-history-title"
            className="text-base font-semibold text-foreground"
          >
            Riwayat sinkronisasi
          </h2>
        </div>
        {jobs.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-muted">
            Belum ada pekerjaan sinkronisasi.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">
                Riwayat pekerjaan sinkronisasi
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-5 py-2.5">
                    Dibuat
                  </th>
                  <th scope="col" className="px-5 py-2.5">
                    Mode
                  </th>
                  <th scope="col" className="px-5 py-2.5">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right">
                    Unit
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right">
                    Durasi
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-5 py-2.5 text-ink-muted">
                      {formatDateTimeId(new Date(job.createdAt))}
                    </td>
                    <td className="px-5 py-2.5 text-ink-muted">
                      {job.dryRun ? "Dry-run" : "Terapkan"}
                    </td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(job.status)}`}
                      >
                        {STATUS_LABEL[job.status]}
                      </span>
                      {job.error ? (
                        <p className="mt-1 text-xs text-ink-muted">
                          {job.error}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-muted">
                      {formatNumberId(job.processed)} /{" "}
                      {job.total === null ? "—" : formatNumberId(job.total)}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-muted">
                      {formatDuration(job)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {stepUpDialog}
    </div>
  );
}
