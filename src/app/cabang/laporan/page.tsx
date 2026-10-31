import type { Metadata } from "next";
import { Download, FileSpreadsheet, Printer, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { STATUS_LABEL, type ContentStatus } from "@/lib/content-status";
import { formatDateTimeId } from "@/lib/dates";
import { getScopedMetrics } from "@/lib/analytics/metrics";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Laporan cabang",
};

export const dynamic = "force-dynamic";

const EXPORT_STATUSES: ContentStatus[] = [
  "APPROVED",
  "SUBMITTED",
  "IN_REVIEW",
  "REVISION_REQUIRED",
  "REJECTED",
];

export default async function BranchReportsPage() {
  const user = await requireRole("BRANCH_ADMIN");
  const metrics = await getScopedMetrics(user);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Laporan cabang
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Unduh data konten {user.scopeLabel}. Berkas dibuat di server dengan
          lingkup akses cabang Anda.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-brand-teal-700" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">Ekspor CSV</h2>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Maksimal 2.000 baris per unduhan, dilindungi pembatas laju 10 permintaan
          per menit.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="h-10">
            <a href="/api/v1/exports/submissions">
              <Download className="mr-2 size-4" aria-hidden />
              Semua konten
            </a>
          </Button>
          {EXPORT_STATUSES.map((status) => (
            <Button key={status} asChild variant="outline" className="h-10">
              <a href={`/api/v1/exports/submissions?status=${status}`}>
                {STATUS_LABEL[status]}
              </a>
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Printer className="size-4 text-brand-blue-700" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            Laporan cetak / PDF
          </h2>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Gunakan cetak browser (Ctrl/Cmd + P) pada halaman analitik. Ringkasan
          periode berjalan: disetujui <strong>{metrics.approved}</strong>, menunggu
          validasi <strong>{metrics.pending}</strong>, perlu revisi{" "}
          <strong>{metrics.revisionRequested}</strong>.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Dibuat {formatDateTimeId(new Date())} WIB · dasar tanggal: tanggal konten.
        </p>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-brand-blue-100 bg-brand-blue-100/40 p-4 text-xs leading-relaxed text-brand-blue-800">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Laporan hanya memuat konten organisasi pada cabang Anda dan memakai
          definisi metrik yang sama dengan dasbor.
        </p>
      </div>
    </div>
  );
}
