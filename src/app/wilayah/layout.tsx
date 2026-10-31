import { AppShell } from "@/components/shell/app-shell";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { requireRole } from "@/lib/session";

export default async function RegionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("REGIONAL_ADMIN");
  const unreadCount = await getUnreadNotificationCount(user.id);

  return (
    <AppShell
      user={user}
      notificationHref="/wilayah/notifikasi"
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
