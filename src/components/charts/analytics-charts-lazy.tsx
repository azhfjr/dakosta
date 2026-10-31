"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps } from "react";

const LazyCharts = dynamic(
  () =>
    import("@/components/charts/analytics-charts").then(
      (mod) => mod.AnalyticsCharts,
    ),
  {
    ssr: false,
    loading: () => (
      <div aria-hidden className="grid gap-6 xl:grid-cols-2">
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

type ChartsProps = ComponentProps<typeof LazyCharts>;

export function DeferredAnalyticsCharts(props: ChartsProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) return;
    const node = hostRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setActive(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div ref={hostRef}>
      {active ? (
        <LazyCharts {...props} />
      ) : (
        <div aria-hidden className="grid gap-6 xl:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-[320px] animate-pulse rounded-xl border border-border bg-surface-muted/50"
            />
          ))}
        </div>
      )}
    </div>
  );
}
