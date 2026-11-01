"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Copy, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { currentPeriod, SUB_THEMES, SUB_THEME_LABELS } from "@/lib/taxonomy";

const SUB_THEME_OPTIONS = SUB_THEMES.map((value) => ({
  value,
  label: SUB_THEME_LABELS[value],
}));

export type PolicyView = {
  id: string;
  period: string;
  status: string;
  version: number;
  explanation: string | null;
  subThemes: string[];
  publishedAtLabel: string | null;
};

export type PolicyEventView = {
  id: string;
  action: string;
  actorId: string | null;
  createdAtLabel: string;
};

export function PolicyManager({
  policies,
  events,
}: {
  policies: PolicyView[];
  events: PolicyEventView[];
}) {
  const router = useRouter();
  const [period, setPeriod] = useState(currentPeriod());
  const [selected, setSelected] = useState<string[]>([]);
  const [explanation, setExplanation] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function resetEditor() {
    setEditingId(null);
    setPeriod(currentPeriod());
    setSelected([]);
    setExplanation("");
  }

  function loadPolicy(policy: PolicyView) {
    setEditingId(policy.id);
    setPeriod(policy.period);
    setSelected(policy.subThemes);
    setExplanation(policy.explanation ?? "");
  }

  function toggleSubTheme(value: string) {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  async function saveDraft() {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      toast.error("Periode harus berformat YYYY-MM.");
      return;
    }
    if (selected.length === 0) {
      toast.error("Pilih minimal satu sub-tema EDUFAST.");
      return;
    }
    setBusy("save");
    try {
      const response = await fetch("/api/v1/admin/edufast/policies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          policyId: editingId ?? undefined,
          period,
          subThemes: selected,
          explanation: explanation || undefined,
        }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        toast.error(body.error?.message ?? "Kebijakan tidak dapat disimpan.");
        return;
      }
      toast.success("Draf kebijakan tersimpan.");
      resetEditor();
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server.");
    } finally {
      setBusy(null);
    }
  }

  async function post(
    path: string,
    payload: Record<string, unknown>,
    message: string,
  ) {
    setBusy(path);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        toast.error(body.error?.message ?? "Tindakan gagal.");
        return;
      }
      toast.success(message);
      setEditingId(null);
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="size-4 text-brand-blue-700" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {editingId ? "Ubah draf kebijakan" : "Buat draf kebijakan"}
          </h2>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Satu kebijakan terbit per periode (YYYY-MM, Asia/Jakarta). Kebijakan
          terbit tidak dapat diubah; buat versi baru sebagai draf.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="policy-period">Periode</Label>
            <Input
              id="policy-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              placeholder="2026-10"
              pattern="\d{4}-(0[1-9]|1[0-2])"
              required
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              Sub-tema yang diizinkan
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {SUB_THEME_OPTIONS.map((item) => (
                <label
                  key={item.value}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={selected.includes(item.value)}
                    onCheckedChange={() => toggleSubTheme(item.value)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-3 space-y-1.5">
          <Label htmlFor="policy-explanation">Penjelasan (opsional)</Label>
          <Textarea
            id="policy-explanation"
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Alasan atau catatan kebijakan bulan ini."
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy !== null}
            onClick={saveDraft}
            className="h-10"
          >
            {busy === "save" ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="mr-2 size-4" aria-hidden />
            )}
            {editingId ? "Simpan draf" : "Buat draf"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={busy !== null}
            onClick={() =>
              post(
                "/api/v1/admin/edufast/policies/copy",
                { period },
                "Draf disalin dari kebijakan bulan sebelumnya.",
              )
            }
          >
            <Copy className="mr-2 size-4" aria-hidden />
            Salin bulan sebelumnya
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              className="h-10"
              onClick={resetEditor}
            >
              Batal
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Kebijakan EDUFAST
          </h2>
          <p className="text-xs text-ink-muted">
            {policies.length} kebijakan tersimpan.
          </p>
        </div>
        {policies.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            Belum ada kebijakan. Buat draf pertama untuk mengaktifkan EDUFAST.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {policies.map((policy) => (
              <li key={policy.id} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {policy.period} · v{policy.version}
                      </p>
                      <span
                        className={
                          policy.status === "PUBLISHED"
                            ? "inline-flex rounded-full border border-status-approved/25 bg-status-approved/10 px-2.5 py-0.5 text-xs font-semibold text-status-approved"
                            : "inline-flex rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-ink-muted"
                        }
                      >
                        {policy.status === "PUBLISHED"
                          ? "Terbit"
                          : policy.status === "DRAFT"
                            ? "Draf"
                            : "Diarsipkan"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      Sub-tema:{" "}
                      {policy.subThemes
                        .map(
                          (value) =>
                            SUB_THEME_LABELS[
                              value as keyof typeof SUB_THEME_LABELS
                            ] ?? value,
                        )
                        .join(", ")}
                    </p>
                    {policy.explanation ? (
                      <p className="mt-1 text-xs text-ink-muted">
                        {policy.explanation}
                      </p>
                    ) : null}
                    {policy.publishedAtLabel ? (
                      <p className="mt-1 text-xs text-ink-muted">
                        Terbit {policy.publishedAtLabel} WIB
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {policy.status === "DRAFT" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={busy !== null}
                        onClick={() => loadPolicy(policy)}
                      >
                        Ubah draf
                      </Button>
                    ) : null}
                    {policy.status === "DRAFT" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8"
                        disabled={busy !== null}
                        onClick={() =>
                          post(
                            "/api/v1/admin/edufast/policies/publish",
                            { policyId: policy.id },
                            "Kebijakan diterbitkan.",
                          )
                        }
                      >
                        <ShieldCheck className="mr-1 size-3.5" aria-hidden />
                        Terbitkan
                      </Button>
                    ) : null}
                    {policy.status === "PUBLISHED" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        disabled={busy !== null}
                        onClick={() =>
                          post(
                            "/api/v1/admin/edufast/policies/archive",
                            { policyId: policy.id },
                            "Kebijakan diarsipkan.",
                          )
                        }
                      >
                        Arsipkan
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Riwayat kebijakan
          </h2>
        </div>
        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            Belum ada peristiwa kebijakan.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="font-medium text-foreground">
                  {event.action}
                </span>
                <span className="text-xs text-ink-muted">
                  {event.createdAtLabel} WIB
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
