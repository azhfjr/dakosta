"use client";

import { Component, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DashboardSectionSkeleton({
  label,
  rows = 2,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <div
        className={
          rows > 2
            ? "grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
            : "grid gap-3 sm:grid-cols-2 sm:gap-4"
        }
      >
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl border border-border bg-surface-muted/50"
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="alert"
      className="rounded-xl border border-status-rejected/30 bg-status-rejected/5 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-status-rejected"
          aria-hidden
        />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            {description}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={pending}
            aria-busy={pending}
            onClick={() => {
              onRetry?.();
              startTransition(() => router.refresh());
            }}
          >
            <RotateCcw className="size-4" aria-hidden />
            {pending ? "Memuat…" : "Coba lagi"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type BoundaryProps = {
  title: string;
  description: string;
  children: ReactNode;
};

type BoundaryState = { failed: boolean };

/** Isolates a dashboard block so one render failure cannot blank the page. */
export class DashboardSectionBoundary extends Component<
  BoundaryProps,
  BoundaryState
> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[dashboard] bagian gagal dirender", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <DashboardErrorState
          title={this.props.title}
          description={this.props.description}
          onRetry={() => this.setState({ failed: false })}
        />
      );
    }
    return this.props.children;
  }
}
