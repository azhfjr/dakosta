"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Isi grafik ditunda sampai kartu mendekati viewport. Halaman analitik dapat
 * memuat belasan grafik sekaligus; menunda yang di luar layar menjaga waktu
 * gambar grafik utama tetap cepat.
 */
export function ChartFrame({
  title,
  description,
  unit,
  actions,
  legend,
  empty,
  emptyMessage = "Belum ada data untuk filter ini.",
  bare = false,
  className,
  children,
}: {
  title: string;
  description?: string;
  unit?: string;
  actions?: ReactNode;
  legend?: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  bare?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLElement | null>(null);
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
    <section
      ref={hostRef}
      aria-label={title}
      className={cn(
        "min-w-0",
        bare
          ? ""
          : "rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 max-w-2xl text-xs text-ink-muted">
              {description}
              {unit ? <span className="ml-1 font-medium">{unit}</span> : null}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {legend ? <div className="mt-2 flex flex-wrap gap-1.5">{legend}</div> : null}
      <div className="mt-4">
        {empty ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 text-center text-sm text-ink-muted">
            {emptyMessage}
          </div>
        ) : nearViewport ? (
          children
        ) : (
          <div
            aria-hidden
            className="min-h-[300px] animate-pulse rounded-lg border border-border bg-surface-muted/40"
          />
        )}
      </div>
    </section>
  );
}

export function ChartLegendChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-xs text-ink-muted">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
      {value ? <span className="font-semibold text-foreground tabular">{value}</span> : null}
    </span>
  );
}
