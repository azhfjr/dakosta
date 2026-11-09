import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SortHeaderProps = {
  href: string;
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  align?: "left" | "right";
  className?: string;
};

/**
 * Shared sortable column header. The URL owns the sort state; `aria-sort`
 * mirrors it so assistive tech and E2E tests read the same source of truth.
 */
export function SortHeader({
  href,
  label,
  active,
  direction,
  align = "left",
  className,
}: SortHeaderProps) {
  const Icon = active
    ? direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ChevronsUpDown;

  return (
    <th
      scope="col"
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn(
        "px-3 py-2.5 text-left text-xs font-medium tracking-wide whitespace-nowrap text-ink-muted uppercase sm:px-4",
        align === "right" && "text-right",
        className,
      )}
    >
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus/40",
          active ? "text-foreground" : undefined,
        )}
      >
        {label}
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            active ? "text-brand-blue-700" : "text-ink-muted/50",
          )}
          aria-hidden
        />
      </Link>
    </th>
  );
}
