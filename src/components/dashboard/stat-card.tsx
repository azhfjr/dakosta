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
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: keyof typeof toneClass;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            toneClass[tone],
          )}
        >
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
