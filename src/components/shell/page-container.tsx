import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const widthClass = {
  narrow: "max-w-4xl",
  default: "max-w-7xl",
  wide: "max-w-[90rem]",
  full: "max-w-none",
} as const;

/**
 * Single page-width contract: `default` for dashboards, tables, and forms;
 * `narrow` for reading and settings pages; `wide` for dense full-width tables.
 */
export function PageContainer({
  width = "default",
  className,
  children,
}: {
  width?: keyof typeof widthClass;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6",
        widthClass[width],
        className,
      )}
    >
      {children}
    </div>
  );
}
