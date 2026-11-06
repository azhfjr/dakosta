import type { Metadata } from "next";
import { History } from "lucide-react";

import { ImportWizard } from "@/components/imports/import-wizard";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { listImports } from "@/lib/imports/accounts";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Impor akun",
};

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  const admin = await requireRole("ADMIN");
  const history = await listImports(10);

  return (
    <PageContainer>
      <PageHeader
        title="Impor akun massal"
        description="Pratinjau, validasi, lalu buat akun dalam satu langkah. Setiap baris menghasilkan kata sandi sementara yang hanya ditampilkan sekali."
      />

      <ImportWizard readOnly={admin.isDemo} />

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <History className="size-4 text-ink-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            Riwayat impor
          </h2>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            Belum ada impor yang dijalankan.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="sr-only">Riwayat impor akun</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    Berkas
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Baris
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Bermasalah
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Dibuat
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Dieksekusi
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-4 py-3 text-foreground">
                      {row.filename}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{row.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumberId(row.rowCount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumberId(row.errorCount)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatDateTimeId(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatDateTimeId(row.committedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
