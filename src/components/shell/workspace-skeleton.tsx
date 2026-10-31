export function WorkspaceSkeleton({ label }: { label: string }) {
  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse space-y-4"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      <div className="h-8 w-64 rounded-lg bg-surface-muted" />
      <div className="h-4 w-96 max-w-full rounded bg-surface-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-xl border border-border bg-surface shadow-sm"
          />
        ))}
      </div>
      <div className="h-72 rounded-xl border border-border bg-surface shadow-sm" />
    </div>
  );
}
