import type { Metadata } from "next";

import { UserManagement } from "@/components/admin/user-management";
import { listAdminUsers, listStakeholderOptions } from "@/lib/users";
import { isDemoMode } from "@/lib/env";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Pengguna",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await requireRole("ADMIN");
  const [users, stakeholders] = await Promise.all([
    listAdminUsers(),
    listStakeholderOptions(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Pengguna
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Kelola akun client, tautkan stakeholder, dan atur status akses.
        </p>
      </header>

      {isDemoMode ? (
        <div className="rounded-xl border border-brand-teal-500/30 bg-brand-teal-100/50 p-4 text-sm leading-relaxed text-brand-teal-700">
          Mode demo aktif: akun DEMO yang di-seed tidak dapat dinonaktifkan dari
          antarmuka ini agar alur demo tetap stabil. Pembuatan akun tetap
          tercatat pada audit.
        </div>
      ) : null}

      <UserManagement
        initialUsers={users}
        stakeholders={stakeholders}
        currentUserId={user.id}
      />
    </div>
  );
}
