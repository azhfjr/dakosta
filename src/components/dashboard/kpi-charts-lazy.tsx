"use client";

import dynamic from "next/dynamic";

export const LazyKpiCharts = dynamic(
  () => import("@/components/dashboard/kpi-charts").then((mod) => mod.KpiCharts),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="grid gap-6 xl:grid-cols-2"
      >
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-[320px] animate-pulse rounded-xl border border-border bg-surface-muted/50"
          />
        ))}
      </div>
    ),
  },
);
