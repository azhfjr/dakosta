import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const widthClass = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
} as const;

/**
 * Single page-width contract. `default` matches the reading width used by the
 * existing dashboards; `wide` is for tables and analytics grids.
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
