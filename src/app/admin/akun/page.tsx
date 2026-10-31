import type { Metadata } from "next";

import { AccountManager } from "@/components/accounts/account-manager";
import { listAccounts, listScopeOptions } from "@/lib/accounts";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Akun",
};

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  const admin = await requireRole("ADMIN");
  const [accounts, options] = await Promise.all([
    listAccounts(),
    listScopeOptions(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Akun & akses
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Kelola akun empat peran, lingkup akses, reset kata sandi, dan pencabutan
          sesi. Perubahan lingkup berlaku segera dan mencabut sesi lama.
        </p>
      </header>

      <AccountManager
        accounts={accounts}
        options={options}
        currentUserId={admin.id}
        readOnly={admin.isDemo}
      />
    </div>
  );
}
