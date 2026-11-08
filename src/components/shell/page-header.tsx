import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  meta,
  eyebrow,
  dense = false,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  eyebrow?: string;
  dense?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        dense && "gap-2 xl:items-center",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-wide text-brand-green-700 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "font-semibold tracking-tight text-foreground",
            dense ? "text-2xl xl:text-xl" : "text-2xl",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-1 max-w-2xl text-ink-muted",
              dense ? "text-sm xl:line-clamp-1 xl:text-xs" : "text-sm",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
      {meta ? (
        <div className="text-xs text-ink-muted sm:text-right">{meta}</div>
      ) : null}
    </header>
  );
}
