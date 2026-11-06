import type { Metadata } from "next";

import { AccountManager } from "@/components/accounts/account-manager";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
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
    <PageContainer>
      <PageHeader
        title="Akun & akses"
        description="Kelola akun empat peran, lingkup akses, reset kata sandi, dan pencabutan sesi. Perubahan lingkup berlaku segera dan mencabut sesi lama."
      />

      <AccountManager
        accounts={accounts}
        options={options}
        currentUserId={admin.id}
        readOnly={admin.isDemo}
      />
    </PageContainer>
  );
}
