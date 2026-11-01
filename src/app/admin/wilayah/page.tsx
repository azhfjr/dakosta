import type { Metadata } from "next";
import Link from "next/link";

import { RegionEditor } from "@/components/hierarchy/hierarchy-editors";
import { formatNumberId } from "@/lib/dates";
import { listRegions } from "@/lib/hierarchy";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Wilayah",
};

export const dynamic = "force-dynamic";

export default async function AdminRegionsPage() {
  const admin = await requireRole("ADMIN");
  const regions = await listRegions(admin.scope);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Wilayah
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Struktur wilayah DAKOSTA beserta jumlah cabang, organisasi, dan
            capaian kontennya. Data mengikuti hierarki region → branch →
            organization.
          </p>
        </div>
        <RegionEditor readOnly={admin.isDemo} />
      </header>

      {admin.isDemo ? (
        <p className="rounded-xl border border-brand-blue-500/25 bg-brand-blue-100/40 px-4 py-3 text-sm text-brand-blue-900">
          Mode demo: perubahan wilayah, cabang, dan organisasi dinonaktifkan.
        </p>
      ) : null}

      {regions.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            Belum ada wilayah terdaftar
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Mulai dari wilayah, lalu tambahkan cabang dan organisasi. Gunakan
            tombol “Tambah wilayah” di kanan atas untuk membuat wilayah pertama.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <caption className="sr-only">
              Daftar wilayah dengan cabang, organisasi, dan capaian
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                <th scope="col" className="px-4 py-3">
                  Wilayah
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Cabang
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Organisasi
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Faskes
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Disetujui
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Menunggu
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Tindakan
                </th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => (
                <tr
                  key={region.id}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">
                      {region.name}
                    </span>
                    <p className="text-xs text-ink-muted">{region.code}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumberId(region.branchCount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumberId(region.organizationCount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumberId(region.faskesCount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumberId(region.approvedCount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumberId(region.pendingCount)}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{region.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/cabang?regionId=${region.id}`}
                        className="text-sm font-medium text-brand-blue-800 underline-offset-4 hover:underline"
                      >
                        Lihat cabang
                      </Link>
                      <RegionEditor
                        region={{
                          id: region.id,
                          code: region.code,
                          name: region.name,
                          status: region.status,
                        }}
                        readOnly={admin.isDemo}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
