import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const toneClass = {
  blue: "bg-brand-blue-100 text-brand-blue-700",
  teal: "bg-brand-teal-100 text-brand-teal-700",
  green: "bg-status-approved/10 text-status-approved",
  amber: "bg-status-review/10 text-status-review",
  red: "bg-status-rejected/10 text-status-rejected",
  neutral: "bg-surface-muted text-ink-muted",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  size = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: keyof typeof toneClass;
  size?: "default" | "compact" | "dense";
}) {
  const dense = size === "dense";
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface shadow-sm",
        dense ? "p-3" : size === "compact" ? "p-4" : "p-4 sm:p-5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "font-medium text-ink-muted",
            dense ? "text-xs" : "text-sm",
          )}
        >
          {label}
        </p>
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg",
            dense ? "size-7" : size === "compact" ? "size-8" : "size-9",
            toneClass[tone],
          )}
        >
          <Icon
            className={
              dense ? "size-4" : size === "compact" ? "size-4" : "size-[18px]"
            }
            aria-hidden
          />
        </span>
      </div>
      <p
        className={cn(
          "font-semibold tracking-tight text-foreground tabular",
          dense
            ? "mt-2 text-xl"
            : size === "compact"
              ? "mt-3 text-2xl"
              : "mt-3 text-3xl",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-1 text-ink-muted",
            dense ? "line-clamp-1 text-[11px] xl:sr-only" : "text-xs",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
