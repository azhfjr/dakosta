import type { Metadata } from "next";

import { NotificationList } from "@/components/notifications/notification-list";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { listNotifications } from "@/lib/notifications";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Notifikasi",
};

export const dynamic = "force-dynamic";

export default async function ClientNotificationsPage() {
  const user = await requireRole("CLIENT");
  const items = await listNotifications(user.id, { limit: 50 });

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Notifikasi"
        description="Keputusan validasi dan pembaruan status konten yang Anda kirimkan."
      />

      <NotificationList items={items} />
    </PageContainer>
  );
}
