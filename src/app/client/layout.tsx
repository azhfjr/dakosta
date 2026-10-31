import { AppShell } from "@/components/shell/app-shell";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { requireRole } from "@/lib/session";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("CLIENT");
  const unreadCount = await getUnreadNotificationCount(user.id);

  return (
    <AppShell
      user={user}
      notificationHref="/client/notifikasi"
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
