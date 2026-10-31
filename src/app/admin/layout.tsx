import { AppShell } from "@/components/shell/app-shell";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { requireRole } from "@/lib/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("ADMIN");
  const unreadCount = await getUnreadNotificationCount(user.id);

  return (
    <AppShell
      user={user}
      notificationHref="/admin/notifikasi"
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
