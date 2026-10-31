import { AlertTriangle, Clock3 } from "lucide-react";

import { formatNumberId } from "@/lib/dates";
import type { RedNoticeEntry } from "@/lib/analytics/red-notice";

function EntryTable({
  entries,
  emptyMessage,
}: {
  entries: RedNoticeEntry[];
  emptyMessage: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface-muted px-4 py-6 text-center text-sm text-ink-muted">
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">Daftar Faskes yang perlu perhatian</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
            <th scope="col" className="px-4 py-3">
              Faskes
            </th>
            <th scope="col" className="px-4 py-3">
              Kode
            </th>
            <th scope="col" className="px-4 py-3">
              Cabang
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Konten terkirim (seumur hidup)
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border/70 last:border-0">
              <td className="px-4 py-3">
                <span className="font-medium text-foreground">{entry.name}</span>
                <p className="mt-0.5 text-xs text-ink-muted">{entry.serviceArea}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                {entry.faskesCode ?? "—"}
              </td>
              <td className="px-4 py-3 text-ink-muted">
                {entry.branchName ?? "Belum ditempatkan"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatNumberId(entry.lifetimeSubmitted)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RedNoticePanel({
  data,
}: {
  data: {
    neverSubmitted: RedNoticeEntry[];
    inactiveInPeriod: RedNoticeEntry[];
    totalFaskes: number;
    month: string;
  };
}) {
  return (
    <div className="space-y-6">
      <section
        aria-labelledby="red-notice-never-title"
        className="rounded-xl border border-status-rejected/30 bg-status-rejected/5 shadow-sm"
      >
        <div className="flex items-start gap-3 border-b border-status-rejected/20 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-5 text-status-rejected" aria-hidden />
          <div>
            <h2 id="red-notice-never-title" className="text-base font-semibold text-foreground">
              Red Notice — belum pernah mengirim ({formatNumberId(data.neverSubmitted.length)})
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Faskes aktif dengan nol konten terkirim sepanjang masa. Draf tidak dihitung.
              Total Faskes aktif pada lingkup ini: {formatNumberId(data.totalFaskes)}.
            </p>
          </div>
        </div>
        <div className="p-4">
          <EntryTable
            entries={data.neverSubmitted}
            emptyMessage="Semua Faskes aktif sudah pernah mengirim konten."
          />
        </div>
      </section>

      <section
        aria-labelledby="red-notice-inactive-title"
        className="rounded-xl border border-status-revision/30 bg-status-revision/5 shadow-sm"
      >
        <div className="flex items-start gap-3 border-b border-status-revision/20 px-4 py-3">
          <Clock3 className="mt-0.5 size-5 text-status-revision" aria-hidden />
          <div>
            <h2 id="red-notice-inactive-title" className="text-base font-semibold text-foreground">
              Tidak mengirim pada periode {data.month} ({formatNumberId(data.inactiveInPeriod.length)})
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Faskes yang pernah mengirim konten tetapi tidak mengirim apa pun pada bulan
              berjalan. Daftar ini terpisah dari Red Notice.
            </p>
          </div>
        </div>
        <div className="p-4">
          <EntryTable
            entries={data.inactiveInPeriod}
            emptyMessage="Semua Faskes pernah mengirim konten pada periode ini."
          />
        </div>
      </section>
    </div>
  );
}
