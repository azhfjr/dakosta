"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Loader2, LogOut, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { isStepUpRequired, useStepUp } from "@/components/auth/step-up-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountRow, ScopeOptions } from "@/lib/accounts";
import { APP_ROLES, ROLE_LABELS, type AppRole } from "@/lib/authz/types";

type Credential = { name: string; email: string; tempPassword: string };

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AccountManager({
  accounts,
  options,
  currentUserId,
}: {
  accounts: AccountRow[];
  options: ScopeOptions;
  currentUserId: string;
}) {
  const router = useRouter();
  const { prompt: promptStepUp, dialog: stepUpDialog } = useStepUp();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<AppRole>("STAKEHOLDER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [displayTitle, setDisplayTitle] = useState("");
  const [regionalOfficeId, setRegionalOfficeId] = useState("");
  const [branchOfficeId, setBranchOfficeId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [creating, setCreating] = useState(false);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter(
      (account) =>
        account.name.toLowerCase().includes(needle) ||
        account.email.toLowerCase().includes(needle) ||
        account.scopeLabel.toLowerCase().includes(needle),
    );
  }, [accounts, query]);

  const filteredBranches = regionalOfficeId
    ? options.branches.filter(
        (branch) => branch.regionalOfficeId === regionalOfficeId,
      )
    : options.branches;

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          displayTitle: displayTitle || undefined,
          role,
          regionalOfficeId:
            role === "REGIONAL_ADMIN" || role === "BRANCH_ADMIN"
              ? regionalOfficeId || undefined
              : undefined,
          branchOfficeId:
            role === "BRANCH_ADMIN" ? branchOfficeId || undefined : undefined,
          organizationId:
            role === "STAKEHOLDER" ? organizationId || undefined : undefined,
        }),
      });
      const body = (await response.json()) as {
        data?: Credential & { userId: string };
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        toast.error(body.error?.message ?? "Akun tidak dapat dibuat.");
        return;
      }
      setCredential({
        name,
        email: body.data.email,
        tempPassword: body.data.tempPassword,
      });
      toast.success("Akun dibuat. Serahkan kata sandi sementara secara langsung.");
      setName("");
      setEmail("");
      setDisplayTitle("");
      setBranchOfficeId("");
      setOrganizationId("");
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server.");
    } finally {
      setCreating(false);
    }
  }

  async function action(account: AccountRow, kind: "reset" | "revoke") {
    async function attempt() {
      setBusyId(account.id);
      try {
        const response = await fetch(`/api/v1/admin/users/${account.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: kind === "reset" ? "reset-password" : "revoke-sessions",
          }),
        });
        const body = (await response.json()) as {
          data?: { tempPassword?: string };
          error?: { code?: string; message?: string };
        };
        if (isStepUpRequired(response, body)) {
          promptStepUp(attempt);
          return;
        }
        if (!response.ok) {
          toast.error(body.error?.message ?? "Tindakan gagal.");
          return;
        }
        if (kind === "reset" && body.data?.tempPassword) {
          setCredential({
            name: account.name,
            email: account.email,
            tempPassword: body.data.tempPassword,
          });
          toast.success("Kata sandi sementara dibuat dan sesi dicabut.");
        } else {
          toast.success("Seluruh sesi akun dicabut.");
        }
        router.refresh();
      } catch {
        toast.error("Tidak dapat menghubungi server.");
      } finally {
        setBusyId(null);
      }
    }
    await attempt();
  }

  async function setStatus(account: AccountRow, status: "ACTIVE" | "SUSPENDED") {
    async function attempt() {
      setBusyId(account.id);
      try {
        const response = await fetch(`/api/v1/admin/users/${account.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const body = (await response.json()) as {
          error?: { code?: string; message?: string };
        };
        if (isStepUpRequired(response, body)) {
          promptStepUp(attempt);
          return;
        }
        if (!response.ok) {
          toast.error(body.error?.message ?? "Status tidak dapat diubah.");
          return;
        }
        toast.success(status === "ACTIVE" ? "Akun diaktifkan." : "Akun ditangguhkan.");
        router.refresh();
      } catch {
        toast.error("Tidak dapat menghubungi server.");
      } finally {
        setBusyId(null);
      }
    }
    await attempt();
  }

  return (
    <div className="space-y-6">
      {credential ? (
        <section
          role="status"
          className="rounded-xl border border-status-revision/40 bg-status-revision/5 p-4"
        >
          <h2 className="text-sm font-semibold text-foreground">
            Kata sandi sementara untuk {credential.name}
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            Tampil satu kali. Serahkan langsung kepada pengguna; mereka wajib
            mengganti kata sandi saat masuk pertama.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm">
              {credential.email}
            </code>
            <code className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm">
              {credential.tempPassword}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              onClick={async () => {
                await navigator.clipboard
                  .writeText(`${credential.email} / ${credential.tempPassword}`)
                  .catch(() => undefined);
                toast.success("Kredensial disalin.");
              }}
            >
              <Copy className="mr-1.5 size-4" aria-hidden />
              Salin
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9"
              onClick={() => setCredential(null)}
            >
              Sembunyikan
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-brand-blue-700" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">Buat akun</h2>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Akun dibuat di dalam DAKOSTA. Kata sandi sementara ditampilkan sekali
          dan tidak dikirim melalui email.
        </p>
        <form onSubmit={createAccount} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="acct-name">Nama</Label>
            <Input
              id="acct-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              maxLength={80}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acct-email">Email</Label>
            <Input
              id="acct-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acct-title">Jabatan (opsional)</Label>
            <Input
              id="acct-title"
              value={displayTitle}
              onChange={(event) => setDisplayTitle(event.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acct-role">Peran</Label>
            <select
              id="acct-role"
              value={role}
              onChange={(event) => setRole(event.target.value as AppRole)}
              className={selectClass}
            >
              {APP_ROLES.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABELS[item]}
                </option>
              ))}
            </select>
          </div>

          {role === "REGIONAL_ADMIN" || role === "BRANCH_ADMIN" ? (
            <div className="space-y-1.5">
              <Label htmlFor="acct-region">Wilayah</Label>
              <select
                id="acct-region"
                value={regionalOfficeId}
                onChange={(event) => {
                  setRegionalOfficeId(event.target.value);
                  setBranchOfficeId("");
                }}
                className={selectClass}
                required
              >
                <option value="">Pilih wilayah</option>
                {options.regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {role === "BRANCH_ADMIN" ? (
            <div className="space-y-1.5">
              <Label htmlFor="acct-branch">Cabang</Label>
              <select
                id="acct-branch"
                value={branchOfficeId}
                onChange={(event) => setBranchOfficeId(event.target.value)}
                className={selectClass}
                required
              >
                <option value="">Pilih cabang</option>
                {filteredBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {role === "STAKEHOLDER" ? (
            <div className="space-y-1.5">
              <Label htmlFor="acct-org">Organisasi</Label>
              <select
                id="acct-org"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                className={selectClass}
                required
              >
                <option value="">Pilih organisasi</option>
                {options.organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                    {organization.branchName ? ` · ${organization.branchName}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex items-end">
            <Button type="submit" disabled={creating} className="h-10">
              {creating ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              Buat akun
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Direktori akun ({filtered.length})
          </h2>
          <label className="relative">
            <span className="sr-only">Cari akun</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama, email, lingkup"
              className="h-10 w-full pl-9 sm:w-72"
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-muted">
            Tidak ada akun yang cocok.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <caption className="sr-only">Direktori akun DAKOSTA</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    Nama
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Peran
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Lingkup
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((account) => (
                  <tr
                    key={account.id}
                    className="border-b border-border/70 align-top last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">
                        {account.name}
                      </span>
                      <p className="text-xs text-ink-muted">{account.email}</p>
                      {account.displayTitle ? (
                        <p className="text-xs text-ink-muted">{account.displayTitle}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{account.roleLabel}</td>
                    <td className="px-4 py-3 text-ink-muted">{account.scopeLabel}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                        {account.status}
                        {account.mustChangePassword ? " · wajib ganti sandi" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={busyId === account.id}
                          onClick={() => action(account, "reset")}
                        >
                          <KeyRound className="mr-1 size-3.5" aria-hidden />
                          Reset
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={busyId === account.id}
                          onClick={() => action(account, "revoke")}
                        >
                          <LogOut className="mr-1 size-3.5" aria-hidden />
                          Cabut sesi
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          disabled={
                            busyId === account.id || account.id === currentUserId
                          }
                          onClick={() =>
                            setStatus(
                              account,
                              account.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                            )
                          }
                        >
                          {account.status === "ACTIVE" ? "Tangguhkan" : "Aktifkan"}
                        </Button>
                      </div>
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
