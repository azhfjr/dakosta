import { AppShell } from "@/components/shell/app-shell";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { requireRole } from "@/lib/session";

export default async function BranchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("BRANCH_ADMIN");
  const unreadCount = await getUnreadNotificationCount(user.id);

  return (
    <AppShell
      user={user}
      notificationHref="/cabang/notifikasi"
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
