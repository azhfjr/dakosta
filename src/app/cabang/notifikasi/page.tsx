import type { Metadata } from "next";

import { NotificationList } from "@/components/notifications/notification-list";
import { listNotifications } from "@/lib/notifications";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Notifikasi cabang",
};

export const dynamic = "force-dynamic";

export default async function BranchNotificationsPage() {
  const user = await requireRole("BRANCH_ADMIN");
  const items = await listNotifications(user.id, { limit: 50 });

  const scoped = items.map((item) => ({
    ...item,
    href: item.href?.startsWith("/admin/validasi")
      ? item.href.replace("/admin/validasi", "/cabang/review")
      : item.href,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Notifikasi
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Pemberitahuan konten baru dan pengiriman ulang pada {user.scopeLabel}.
        </p>
      </header>

      <NotificationList items={scoped} />
    </div>
  );
}
