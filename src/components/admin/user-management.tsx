"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Copy,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CLIENT" | null;
  active: boolean;
  mustChangePassword: boolean;
  isDemo: boolean;
  displayTitle: string | null;
  createdAt: string;
  stakeholders: Array<{ id: string; name: string }>;
};

export type StakeholderOption = {
  id: string;
  name: string;
  serviceArea: string;
};

type ApiError = { error?: { message?: string; code?: string } };

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} disalin.`);
  } catch {
    toast.error("Tidak dapat menyalin. Salin secara manual.");
  }
}

export function UserManagement({
  initialUsers,
  stakeholders,
  currentUserId,
}: {
  initialUsers: UserRow[];
  stakeholders: StakeholderOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [displayTitle, setDisplayTitle] = useState("");
  const [selectedStakeholders, setSelectedStakeholders] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [credentials, setCredentials] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);

  const [manageUser, setManageUser] = useState<UserRow | null>(null);
  const [manageActive, setManageActive] = useState(true);
  const [manageStakeholders, setManageStakeholders] = useState<string[]>([]);
  const [manageError, setManageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetCreateForm() {
    setName("");
    setEmail("");
    setDisplayTitle("");
    setSelectedStakeholders([]);
    setFormError(null);
  }

  function toggleStakeholder(
    id: string,
    current: string[],
    setCurrent: (next: string[]) => void,
  ) {
    setCurrent(
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (selectedStakeholders.length === 0) {
      setFormError("Pilih minimal satu stakeholder.");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          displayTitle: displayTitle || undefined,
          stakeholderIds: selectedStakeholders,
        }),
      });
      const payload = (await response.json()) as ApiError & {
        data?: { email: string; tempPassword: string };
      };

      if (!response.ok || !payload.data) {
        setFormError(
          payload.error?.message ?? "Akun tidak dapat dibuat. Coba lagi.",
        );
        return;
      }

      setCreateOpen(false);
      resetCreateForm();
      setCredentials({
        email: payload.data.email,
        tempPassword: payload.data.tempPassword,
      });
      startTransition(() => router.refresh());
    } catch {
      setFormError("Tidak dapat menghubungi server.");
    } finally {
      setCreating(false);
    }
  }

  function openManage(user: UserRow) {
    setManageUser(user);
    setManageActive(user.active);
    setManageStakeholders(user.stakeholders.map((item) => item.id));
    setManageError(null);
  }

  async function handleManageSave() {
    if (!manageUser) return;
    setSaving(true);
    setManageError(null);

    try {
      const body: { active?: boolean; stakeholderIds?: string[] } = {
        active: manageActive,
      };
      if (manageUser.role === "CLIENT") {
        if (manageStakeholders.length === 0) {
          setManageError("Stakeholder tidak boleh kosong.");
          setSaving(false);
          return;
        }
        body.stakeholderIds = manageStakeholders;
      }

      const response = await fetch(`/api/v1/admin/users/${manageUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as ApiError;

      if (!response.ok) {
        setManageError(payload.error?.message ?? "Perubahan gagal disimpan.");
        return;
      }

      toast.success("Perubahan pengguna tersimpan.");
      setManageUser(null);
      startTransition(() => router.refresh());
    } catch {
      setManageError("Tidak dapat menghubungi server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {initialUsers.length} akun terdaftar. Registrasi publik ditutup;
          akun dibuat oleh admin dengan kata sandi sementara.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Tambah pengguna
        </Button>
      </div>

      <div className="relative overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <caption className="sr-only">Daftar akun pengguna</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
              <th scope="col" className="px-5 py-3">Pengguna</th>
              <th scope="col" className="px-5 py-3">Peran</th>
              <th scope="col" className="px-5 py-3">Stakeholder</th>
              <th scope="col" className="px-5 py-3">Status</th>
              <th scope="col" className="px-5 py-3 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((user) => (
              <tr key={user.id} className="border-b border-border/70 last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-ink-muted">{user.email}</p>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted">
                    {user.role === "ADMIN" ? "Admin" : "Client"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {user.stakeholders.length === 0 ? (
                    <span className="text-xs text-ink-muted">—</span>
                  ) : (
                    <ul className="flex flex-wrap gap-1">
                      {user.stakeholders.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-full border border-brand-blue-100 bg-brand-blue-100/60 px-2 py-0.5 text-xs text-brand-blue-800"
                        >
                          {item.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-col gap-1">
                    <span
                      className={
                        user.active
                          ? "text-xs font-medium text-status-approved"
                          : "text-xs font-medium text-status-rejected"
                      }
                    >
                      {user.active ? "Aktif" : "Nonaktif"}
                    </span>
                    {user.mustChangePassword ? (
                      <span className="text-xs text-status-review">
                        Wajib ganti kata sandi
                      </span>
                    ) : null}
                    {user.isDemo ? (
                      <span className="text-xs text-ink-muted">Akun DEMO</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openManage(user)}
                  >
                    <UserCog className="size-3.5" aria-hidden />
                    Kelola
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah pengguna client</DialogTitle>
            <DialogDescription>
              Kata sandi sementara dibuat otomatis dan hanya ditampilkan sekali.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-name">Nama</Label>
                <Input
                  id="new-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-title">Jabatan (opsional)</Label>
                <Input
                  id="new-title"
                  value={displayTitle}
                  onChange={(event) => setDisplayTitle(event.target.value)}
                  maxLength={80}
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-email">Email demo</Label>
              <Input
                id="new-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@demo.dakosta.local"
                required
                className="h-10"
              />
              <p className="text-xs text-ink-muted">
                Wajib memakai domain @demo.dakosta.local agar data tetap
                sintetis.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                Stakeholder
              </legend>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {stakeholders.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-muted"
                  >
                    <Checkbox
                      checked={selectedStakeholders.includes(option.id)}
                      onCheckedChange={() =>
                        toggleStakeholder(
                          option.id,
                          selectedStakeholders,
                          setSelectedStakeholders,
                        )
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground">
                        {option.name}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {option.serviceArea}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {formError ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Batal
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {creating ? "Membuat…" : "Buat akun"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={credentials !== null}
        onOpenChange={(open) => {
          if (!open) setCredentials(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kredensial sementara</DialogTitle>
            <DialogDescription>
              Serahkan kepada pengguna melalui saluran aman. Kata sandi tidak
              dapat ditampilkan lagi.
            </DialogDescription>
          </DialogHeader>

          {credentials ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-surface-muted p-3">
                <p className="text-xs font-medium text-ink-muted">Email</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className="text-sm break-all text-foreground">
                    {credentials.email}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Salin email"
                    onClick={() => copyToClipboard(credentials.email, "Email")}
                  >
                    <Copy className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-brand-blue-100 bg-brand-blue-100/50 p-3">
                <p className="text-xs font-medium text-brand-blue-800">
                  Kata sandi sementara
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className="text-sm font-semibold break-all text-brand-blue-900">
                    {credentials.tempPassword}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Salin kata sandi sementara"
                    onClick={() =>
                      copyToClipboard(credentials.tempPassword, "Kata sandi")
                    }
                  >
                    <Copy className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>

              <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
                <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
                Pengguna wajib mengganti kata sandi ini saat pertama masuk.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" onClick={() => setCredentials(null)}>
              Saya sudah menyalin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={manageUser !== null}
        onOpenChange={(open) => {
          if (!open) setManageUser(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kelola pengguna</DialogTitle>
            <DialogDescription>
              {manageUser?.name} · {manageUser?.email}
            </DialogDescription>
          </DialogHeader>

          {manageUser ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Akun aktif</p>
                  <p className="text-xs text-ink-muted">
                    Akun nonaktif tidak bisa masuk.
                  </p>
                </div>
                <Switch
                  checked={manageActive}
                  onCheckedChange={setManageActive}
                  disabled={manageUser.id === currentUserId}
                  aria-label="Status aktif akun"
                />
              </div>

              {manageUser.role === "CLIENT" ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-foreground">
                    Stakeholder
                  </legend>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                    {stakeholders.map((option) => (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-muted"
                      >
                        <Checkbox
                          checked={manageStakeholders.includes(option.id)}
                          onCheckedChange={() =>
                            toggleStakeholder(
                              option.id,
                              manageStakeholders,
                              setManageStakeholders,
                            )
                          }
                          className="mt-0.5"
                        />
                        <span className="text-sm text-foreground">
                          {option.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <p className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-3 text-xs text-ink-muted">
                  <ShieldCheck className="size-4" aria-hidden />
                  Akun admin tidak memiliki keterkaitan stakeholder.
                </p>
              )}

              {manageError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {manageError}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setManageUser(null)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button type="button" onClick={handleManageSave} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
