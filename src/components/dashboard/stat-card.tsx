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
  id,
  label,
  value,
  hint,
  share,
  icon: Icon,
  tone = "blue",
  size = "default",
}: {
  id?: string;
  label: string;
  value: string;
  hint?: string;
  /** Optional small percentage shown beside the value; never a headline. */
  share?: { value: string; srLabel: string };
  icon: LucideIcon;
  tone?: keyof typeof toneClass;
  size?: "default" | "compact";
}) {
  return (
    <div
      id={id}
      data-dashboard-panel
      className="h-full rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg",
            size === "compact" ? "size-8" : "size-9",
            toneClass[tone],
          )}
        >
          <Icon
            className={size === "compact" ? "size-4" : "size-[18px]"}
            aria-hidden
          />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p
          className={cn(
            "font-semibold tracking-tight text-foreground tabular",
            size === "compact" ? "text-2xl" : "text-3xl",
          )}
        >
          {value}
        </p>
        {share ? (
          <span
            data-stat-share={share.value}
            aria-label={share.srLabel}
            className="text-xs font-semibold text-ink-muted tabular"
          >
            {share.value}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
