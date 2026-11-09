import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  meta,
  eyebrow,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <header
      data-page-header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-wide text-brand-green-700 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions || meta ? (
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {actions ? (
            <div
              data-page-header-actions
              className="flex flex-wrap items-center gap-2 sm:justify-end"
            >
              {actions}
            </div>
          ) : null}
          {meta ? (
            <div
              data-page-header-meta
              className="text-xs text-ink-muted sm:text-right"
            >
              {meta}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
