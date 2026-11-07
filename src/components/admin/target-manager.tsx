"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Pencil,
  Plus,
  Target as TargetIcon,
  Trash2,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumberId } from "@/lib/dates";
import { SUB_THEMES, SUB_THEME_LABELS } from "@/lib/taxonomy";
import type { TargetScopeRow, TargetStakeholderOption } from "@/lib/targets";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function scopeLabel(row: {
  stakeholderName: string | null;
  subThemeLabel: string | null;
}): string {
  if (row.stakeholderName && row.subThemeLabel) {
    return `${row.stakeholderName} · ${row.subThemeLabel}`;
  }
  if (row.stakeholderName) return row.stakeholderName;
  if (row.subThemeLabel) return `Tema ${row.subThemeLabel}`;
  return "Workspace (global)";
}

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${formatNumberId(value)}%`;
}

type FormState = {
  stakeholderId: string;
  subTheme: string;
  targetCount: string;
  reportingUnit: string;
};

const EMPTY_FORM: FormState = {
  stakeholderId: "",
  subTheme: "",
  targetCount: "",
  reportingUnit: "konten",
};

export function TargetManager({
  month,
  rows,
  demo,
}: {
  month: string;
  rows: TargetScopeRow[];
  demo: boolean;
}) {
  const router = useRouter();
  const { prompt: promptStepUp, dialog: stepUpDialog } = useStepUp();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<TargetScopeRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [stakeholders, setStakeholders] = useState<
    TargetStakeholderOption[] | null
  >(null);
  const [loadingStakeholders, setLoadingStakeholders] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  async function ensureStakeholders() {
    if (stakeholders !== null || loadingStakeholders) return;
    setLoadingStakeholders(true);
    try {
      const response = await fetch("/api/v1/admin/targets/stakeholders");
      const body = (await response.json()) as {
        data?: { stakeholders?: TargetStakeholderOption[] };
      };
      if (!response.ok || !body.data?.stakeholders) {
        throw new Error("Daftar stakeholder tidak tersedia.");
      }
      setStakeholders(body.data.stakeholders);
    } catch {
      toast.error("Daftar stakeholder tidak dapat dimuat.");
    } finally {
      setLoadingStakeholders(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setSelectedLabel(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
    void ensureStakeholders();
  }

  function openEdit(row: TargetScopeRow) {
    setEditingId(row.id);
    setSelectedLabel(row.stakeholderName);
    setForm({
      stakeholderId: row.stakeholderId ?? "",
      subTheme: row.subTheme ?? "",
      targetCount: String(row.targetCount),
      reportingUnit: "konten",
    });
    setDialogOpen(true);
    void ensureStakeholders();
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const targetCount = Number(form.targetCount);
    if (!Number.isInteger(targetCount) || targetCount < 0) {
      toast.error("Target harus berupa bilangan bulat 0 atau lebih.");
      return;
    }

    const payload = {
      stakeholderId: form.stakeholderId || null,
      subTheme: form.subTheme || null,
      targetCount,
      reportingUnit: form.reportingUnit.trim() || "konten",
    };

    async function attempt() {
      setSaving(true);
      try {
        const response = await fetch(
          editingId
            ? `/api/v1/admin/targets/${editingId}`
            : "/api/v1/admin/targets",
          {
            method: editingId ? "PATCH" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(editingId ? payload : { month, ...payload }),
          },
        );
        const body = (await response.json()) as {
          error?: { code?: string; message?: string };
        };
        if (isStepUpRequired(response, body)) {
          promptStepUp(attempt);
          return;
        }
        if (!response.ok) {
          toast.error(body.error?.message ?? "Target tidak dapat disimpan.");
          return;
        }
        toast.success(editingId ? "Target diperbarui." : "Target ditambahkan.");
        setDialogOpen(false);
        setForm(EMPTY_FORM);
        setEditingId(null);
        router.refresh();
      } catch {
        toast.error("Tidak dapat menghubungi server.");
      } finally {
        setSaving(false);
      }
    }

    await attempt();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;

    async function attempt() {
      setDeleteBusy(true);
      try {
        const response = await fetch(`/api/v1/admin/targets/${target.id}`, {
          method: "DELETE",
        });
        const body = (await response.json()) as {
          error?: { code?: string; message?: string };
        };
        if (isStepUpRequired(response, body)) {
          promptStepUp(attempt);
          return;
        }
        if (!response.ok) {
          toast.error(body.error?.message ?? "Target tidak dapat dihapus.");
          return;
        }
        toast.success("Target dihapus.");
        setDeleting(null);
        router.refresh();
      } catch {
        toast.error("Tidak dapat menghubungi server.");
      } finally {
        setDeleteBusy(false);
      }
    }

    await attempt();
  }

  return (
    <section
      aria-labelledby="target-daftar"
      className="rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="target-daftar"
            className="text-base font-semibold text-foreground"
          >
            Cakupan target
          </h2>
          <p className="text-xs text-ink-muted">
            Target global, per stakeholder, per tema, atau kombinasi keduanya.
            Nilai capaian dihitung ulang dari data konten.
          </p>
        </div>
        {demo ? null : (
          <Button type="button" className="h-10" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Tambah target
          </Button>
        )}
      </div>

      {demo ? (
        <p className="border-b border-border bg-brand-blue-100/40 px-5 py-3 text-sm text-brand-blue-900">
          Mode demo: penetapan dan perubahan target dinonaktifkan. Nilai capaian
          tetap dihitung dari data demo.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <TargetIcon className="mx-auto size-8 text-ink-muted" aria-hidden />
          <p className="mt-3 text-sm font-medium text-foreground">
            Belum ada target untuk periode ini
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Tetapkan target global atau per cakupan agar capaian periode ini
            dapat dipantau pada dasbor dan peta.
          </p>
          {demo ? null : (
            <Button type="button" className="mt-4 h-10" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Tetapkan target pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <caption className="sr-only">
              Target per cakupan pada periode terpilih
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                <th scope="col" className="px-5 py-3">
                  Cakupan
                </th>
                <th scope="col" className="px-5 py-3 text-right">
                  Target
                </th>
                <th scope="col" className="px-5 py-3 text-right">
                  Disetujui
                </th>
                <th scope="col" className="px-5 py-3">
                  Capaian
                </th>
                <th scope="col" className="px-5 py-3">
                  Periode
                </th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Tindakan</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const progress =
                  row.achievement === null ? 0 : Math.min(100, row.achievement);
                const label = scopeLabel(row);
                const achievementHref = `/admin/konten?month=${month}${
                  row.stakeholderId ? `&stakeholderId=${row.stakeholderId}` : ""
                }${row.subTheme ? `&subTheme=${row.subTheme}` : ""}`;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border/70 align-top last:border-0"
                  >
                    <td className="px-5 py-3 font-medium text-foreground">
                      {label}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-muted tabular">
                      {formatNumberId(row.targetCount)}
                    </td>
                    <td className="px-5 py-3 text-right text-foreground tabular">
                      {formatNumberId(row.approved)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-24 overflow-hidden rounded-full bg-surface-muted"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(progress)}
                          aria-label={`Capaian ${label}`}
                        >
                          <div
                            className="h-full rounded-full bg-brand-blue-600"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-foreground tabular">
                          {formatPercent(row.achievement)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {row.periodStart} — {row.periodEnd}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-9"
                        >
                          <Link href={achievementHref}>Lihat capaian</Link>
                        </Button>
                        {demo ? null : (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label={`Ubah target ${label}`}
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label={`Hapus target ${label}`}
                              onClick={() => setDeleting(row)}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Ubah target" : "Tambah target"}
            </DialogTitle>
            <DialogDescription>
              Pilih cakupan target. Cakupan yang lebih spesifik dipakai lebih
              dulu saat menghitung capaian.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label htmlFor="target-stakeholder">Stakeholder</Label>
              <select
                id="target-stakeholder"
                value={form.stakeholderId}
                disabled={loadingStakeholders}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    stakeholderId: event.target.value,
                  }))
                }
                className={`mt-1.5 ${selectClass}`}
              >
                <option value="">Semua stakeholder (global)</option>
                {loadingStakeholders ? (
                  <option value="__loading" disabled>
                    Memuat daftar stakeholder…
                  </option>
                ) : null}
                {form.stakeholderId &&
                !(stakeholders ?? []).some(
                  (stakeholder) => stakeholder.id === form.stakeholderId,
                ) ? (
                  <option value={form.stakeholderId}>
                    {selectedLabel ?? "Stakeholder terpilih"}
                  </option>
                ) : null}
                {(stakeholders ?? []).map((stakeholder) => (
                  <option key={stakeholder.id} value={stakeholder.id}>
                    {stakeholder.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="target-subtheme">Tema</Label>
              <select
                id="target-subtheme"
                value={form.subTheme}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    subTheme: event.target.value,
                  }))
                }
                className={`mt-1.5 ${selectClass}`}
              >
                <option value="">Semua tema</option>
                {SUB_THEMES.map((subTheme) => (
                  <option key={subTheme} value={subTheme}>
                    {SUB_THEME_LABELS[subTheme]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="target-count">Jumlah target</Label>
              <Input
                id="target-count"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                required
                value={form.targetCount}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    targetCount: event.target.value,
                  }))
                }
                className="mt-1.5 h-10"
              />
            </div>
            <div>
              <Label htmlFor="target-unit">Satuan pelaporan</Label>
              <Input
                id="target-unit"
                value={form.reportingUnit}
                maxLength={40}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    reportingUnit: event.target.value,
                  }))
                }
                className="mt-1.5 h-10"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button type="submit" className="h-10" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {editingId ? "Simpan perubahan" : "Tambah target"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus target ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `Target ${scopeLabel(deleting)} pada ${month} akan dihapus. Capaian periode tetap dihitung dari konten disetujui.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Hapus target
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {stepUpDialog}
    </section>
  );
}
