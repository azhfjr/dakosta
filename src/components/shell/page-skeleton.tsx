/** Placeholder streaming untuk halaman data. Blok dibuat mendekati ukuran konten akhir agar CLS kecil. */
export function PageSkeleton({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto w-full max-w-7xl space-y-6"
    >
      <span className="sr-only">{label}</span>

      <div
        aria-hidden
        className="h-[92px] animate-pulse rounded-xl border border-border bg-surface-muted/50"
      />

      <div aria-hidden className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[104px] animate-pulse rounded-xl border border-border bg-surface-muted/50"
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          aria-hidden
          className="h-[340px] animate-pulse rounded-xl border border-border bg-surface-muted/50"
        />
        <div
          aria-hidden
          className="h-[340px] animate-pulse rounded-xl border border-border bg-surface-muted/50"
        />
      </div>

      <div
        aria-hidden
        className="h-[280px] animate-pulse rounded-xl border border-border bg-surface-muted/50"
      />
    </div>
  );
}
