import type { Metadata } from "next";

import { NotificationList } from "@/components/notifications/notification-list";
import { listNotifications } from "@/lib/notifications";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Notifikasi",
};

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const user = await requireRole("ADMIN");
  const items = await listNotifications(user.id, { limit: 50 });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Notifikasi
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Pemberitahuan pengiriman konten baru dan pembaruan yang membutuhkan
          tindakan admin.
        </p>
      </header>

      <NotificationList items={items} />
    </div>
  );
}
