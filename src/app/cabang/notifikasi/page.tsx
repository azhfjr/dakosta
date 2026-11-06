import type { Metadata } from "next";

import { NotificationList } from "@/components/notifications/notification-list";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
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
    <PageContainer width="narrow">
      <PageHeader
        title="Notifikasi"
        description={`Pemberitahuan konten baru dan pengiriman ulang pada ${user.scopeLabel}.`}
      />

      <NotificationList items={scoped} />
    </PageContainer>
  );
}
