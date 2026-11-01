import { formatNumberId } from "@/lib/dates";
import type { RankingRow } from "@/lib/hierarchy";

export function RankingsTable({
  rows,
  title = "Peringkat Faskes",
  description = "Diurutkan berdasarkan konten disetujui, lalu nama dan kode sebagai penentu seri.",
}: {
  rows: RankingRow[];
  title?: string;
  description?: string;
}) {
  return (
    <section
      aria-labelledby="rankings-title"
      className="rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="border-b border-border px-4 py-3">
        <h2
          id="rankings-title"
          className="text-base font-semibold text-foreground"
        >
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-muted">
          Belum ada Faskes pada lingkup ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                <th scope="col" className="px-4 py-3">
                  #
                </th>
                <th scope="col" className="px-4 py-3">
                  Faskes
                </th>
                <th scope="col" className="px-4 py-3">
                  Jenis
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Disetujui
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Terkirim
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Rasio
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">
                      {row.name}
                    </span>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {row.branchName ?? "—"} · {row.faskesCode ?? "tanpa kode"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {row.faskesClass ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumberId(row.approvedCount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumberId(row.submittedCount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.approvalRate === null
                      ? "N/A"
                      : `${formatNumberId(Math.round(row.approvalRate * 1000) / 10)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
