"use client";

import dynamic from "next/dynamic";

export const LazyMonthlyTrendChart = dynamic(
  () =>
    import("@/components/dashboard/monthly-trend-chart").then(
      (mod) => mod.MonthlyTrendChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="h-[380px] animate-pulse rounded-xl border border-border bg-surface-muted/50"
      />
    ),
  },
);
