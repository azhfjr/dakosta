"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type {
  DashboardAllContentAnalytics,
  DashboardApprovedAnalytics,
} from "@/lib/analytics/charts";

const AllContentCharts = dynamic(
  () =>
    import("@/components/dashboard/dashboard-analytics").then(
      (mod) => mod.AllContentCharts,
    ),
  { ssr: false, loading: () => <ChartsSkeleton /> },
);

const ApprovedCharts = dynamic(
  () =>
    import("@/components/dashboard/dashboard-analytics").then(
      (mod) => mod.ApprovedCharts,
    ),
  { ssr: false, loading: () => <ChartsSkeleton /> },
);

function ChartsSkeleton() {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="min-h-[280px] animate-pulse rounded-xl border border-border bg-surface-muted/40"
        />
      ))}
    </div>
  );
}

function Deferred({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    if (nearViewport) return;
    const node = hostRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setNearViewport(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nearViewport]);

  return (
    <div ref={hostRef}>{nearViewport ? children : <ChartsSkeleton />}</div>
  );
}

export function DeferredAllContentCharts({
  data,
}: {
  data: DashboardAllContentAnalytics;
}) {
  return (
    <Deferred>
      <AllContentCharts data={data} />
    </Deferred>
  );
}

export function DeferredApprovedCharts({
  data,
  target,
}: {
  data: DashboardApprovedAnalytics;
  target: { approved: number; target: number | null } | null;
}) {
  return (
    <Deferred>
      <ApprovedCharts data={data} target={target} />
    </Deferred>
  );
}
