"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { getNavItems, isActivePath } from "@/components/shell/navigation";

export function SidebarNav({
  role,
  onNavigate,
}: {
  role: "ADMIN" | "CLIENT";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = getNavItems(role);

  return (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActivePath(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus/40",
              active
                ? "bg-brand-blue-100 text-brand-blue-800"
                : "text-ink-muted hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-[18px] shrink-0",
                active ? "text-brand-blue-700" : "text-ink-muted",
              )}
              aria-hidden
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
