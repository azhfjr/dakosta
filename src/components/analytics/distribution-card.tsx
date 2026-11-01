import { formatNumberId } from "@/lib/dates";
import type { DistributionRow } from "@/lib/analytics/distribution";

export function DistributionCard({
  title,
  description,
  rows,
  emptyMessage = "Belum ada data pada lingkup ini.",
}: {
  title: string;
  description?: string;
  rows: DistributionRow[];
  emptyMessage?: string;
}) {
  const max = rows.reduce((value, row) => Math.max(value, row.total), 0);
  return (
    <section
      aria-labelledby={`dist-${title.replace(/\s+/g, "-").toLowerCase()}`}
      className="rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="border-b border-border px-4 py-3">
        <h2
          id={`dist-${title.replace(/\s+/g, "-").toLowerCase()}`}
          className="text-base font-semibold text-foreground"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted">
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {rows.map((row) => (
            <li key={row.key} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-foreground">{row.label}</span>
                <span className="tabular-nums text-ink-muted">
                  {formatNumberId(row.total)}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                role="presentation"
              >
                <div
                  className="h-full rounded-full bg-brand-blue-500"
                  style={{
                    width:
                      max > 0
                        ? `${Math.max(4, (row.total / max) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
