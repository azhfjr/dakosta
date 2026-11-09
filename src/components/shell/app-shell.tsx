import Link from "next/link";
import { Bell } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { NotificationStream } from "@/components/notifications/notification-stream";
import { SiteFooter } from "@/components/site-footer";
import { MobileNav } from "@/components/shell/mobile-nav";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { isDemoMode } from "@/lib/env";
import type { SessionUser } from "@/lib/session";

export function AppShell({
  user,
  notificationHref,
  unreadCount,
  children,
}: {
  user: SessionUser;
  notificationHref?: string;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface-muted/60 print:block print:bg-white lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <NotificationStream />
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface print:hidden lg:flex">
        <div className="px-4 pt-5 pb-4">
          <BrandLogo variant="compact" className="w-32" />
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Dashboard Konten Kolaborasi Stakeholder
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <SidebarNav role={user.role} />
        </div>
        <div className="border-t border-border p-3">
          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            displayTitle={user.displayTitle}
          />
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur print:hidden sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav
              role={user.role}
              name={user.name}
              email={user.email}
              displayTitle={user.displayTitle}
            />
            <div className="lg:hidden">
              <BrandLogo variant="compact" className="w-24" />
            </div>
            <p className="hidden truncate text-sm text-ink-muted lg:block">
              Ruang kerja{" "}
              <span className="font-medium text-foreground">
                {user.scopeLabel}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {isDemoMode ? (
              <span className="hidden items-center rounded-full border border-brand-teal-500/30 bg-brand-teal-100 px-2.5 py-1 text-xs font-semibold text-brand-teal-700 sm:inline-flex">
                Data sintetis · DEMO
              </span>
            ) : null}
            {notificationHref ? (
              <Link
                href={notificationHref}
                className="relative inline-flex size-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus/40"
                aria-label={
                  unreadCount && unreadCount > 0
                    ? `Notifikasi, ${unreadCount} belum dibaca`
                    : "Notifikasi"
                }
              >
                <Bell className="size-5" aria-hidden />
                {unreadCount && unreadCount > 0 ? (
                  <span
                    aria-hidden
                    className="absolute top-1.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-rejected px-1 text-[10px] font-semibold text-white tabular"
                  >
                    {unreadCount}
                  </span>
                ) : null}
              </Link>
            ) : null}
            <div className="w-11 lg:hidden">
              <UserMenu
                name={user.name}
                email={user.email}
                role={user.role}
                displayTitle={user.displayTitle}
                compact
              />
            </div>
          </div>
        </header>

        <main
          id="konten"
          className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0"
        >
          {user.role !== "MASTER_ADMIN" &&
          user.locationStatus !== "VERIFIED" &&
          user.locationStatus !== "EXEMPT" ? (
            <div className="mb-5 flex flex-col gap-2 rounded-xl border border-status-review/30 bg-status-review/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-ink-muted">
                <span className="font-semibold text-foreground">
                  Lokasi belum diaktifkan.
                </span>{" "}
                {user.locationGraceDeadline
                  ? `Selesaikan sebelum ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(user.locationGraceDeadline)} WIB agar akses tidak terhenti.`
                  : "Aktifkan lokasi perangkat satu kali untuk memakai semua fitur."}
              </p>
              <Link
                href="/aktivasi-lokasi"
                className="font-semibold whitespace-nowrap text-brand-blue-800 underline-offset-4 hover:underline"
              >
                Aktivasi sekarang
              </Link>
            </div>
          ) : null}
          {children}
        </main>

        <div className="print:hidden">
          <SiteFooter compact />
        </div>
      </div>
    </div>
  );
}
