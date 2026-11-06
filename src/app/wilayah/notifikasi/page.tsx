import type { Metadata } from "next";

import { NotificationList } from "@/components/notifications/notification-list";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { listNotifications } from "@/lib/notifications";
import { requireRole } from "@/lib/session";

function regionalHref(href: string | null): string | null {
  if (!href?.startsWith("/admin/validasi")) return href;
  if (href.startsWith("/admin/validasi/")) {
    return href.replace("/admin/validasi/", "/wilayah/konten/");
  }
  return href.replace("/admin/validasi", "/wilayah");
}

export const metadata: Metadata = {
  title: "Notifikasi wilayah",
};

export const dynamic = "force-dynamic";

export default async function RegionalNotificationsPage() {
  const user = await requireRole("REGIONAL_ADMIN");
  const items = await listNotifications(user.id, { limit: 50 });

  const scoped = items.map((item) => ({
    ...item,
    href: regionalHref(item.href),
  }));

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Notifikasi"
        description={`Pemberitahuan aktivitas konten pada ${user.scopeLabel}. Tautan diarahkan ke tampilan baca-saja wilayah.`}
      />

      <NotificationList items={scoped} />
    </PageContainer>
  );
}
