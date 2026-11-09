"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { getNavSections, isActivePath } from "@/components/shell/navigation";
import type { AppRole } from "@/lib/authz/types";

export function SidebarNav({
  role,
  onNavigate,
}: {
  role: AppRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = getNavSections(role);

  return (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          {section.label ? (
            <p className="px-3 pt-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
              {section.label}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = isActivePath(pathname, item);
            const success = item.tone === "success";
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
                  success
                    ? "bg-status-approved text-white shadow-sm hover:bg-status-approved/90"
                    : active
                      ? "bg-brand-blue-100 text-brand-blue-800"
                      : "text-ink-muted hover:bg-surface-muted hover:text-foreground",
                  success && active
                    ? "ring-2 ring-status-approved/30 ring-offset-1 ring-offset-surface"
                    : null,
                )}
              >
                <Icon
                  className={cn(
                    "size-[18px] shrink-0",
                    success
                      ? "text-white"
                      : active
                        ? "text-brand-blue-700"
                        : "text-ink-muted",
                  )}
                  aria-hidden
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
