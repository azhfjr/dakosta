import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, MapPinned, Shapes, Target } from "lucide-react";

import { MapExplorer } from "@/components/map/map-explorer";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/content/status-badge";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { MAP_STYLE_URL } from "@/lib/geo";
import { getMapOverview, parseMapFilters } from "@/lib/map";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Peta cabang",
};

export const dynamic = "force-dynamic";

export default async function BranchMapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("BRANCH_ADMIN");
  const params = await searchParams;
  const filters = parseMapFilters(params);
  const overview = await getMapOverview(user, filters);
  const mapKey = `cabang-${filters.status}`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Peta cabang
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Sebaran konten dan lokasi Faskes di {user.scopeLabel}. Lokasi
            perkiraan ditampilkan sebagai cincin.
          </p>
        </div>
        <p className="text-xs text-ink-muted">
          Diperbarui {formatDateTimeId(overview.generatedAt)} WIB
        </p>
      </header>

      <section
        aria-label="Ringkasan sebaran cabang"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Titik konten"
          value={formatNumberId(overview.totals.points)}
          hint="Konten non-draf"
          icon={MapPin}
          tone="blue"
        />
        <StatCard
          label="Lokasi presisi"
          value={formatNumberId(overview.totals.exactPoints)}
          hint="GPS dengan akurasi ≤ 100 m"
          icon={Target}
          tone="teal"
        />
        <StatCard
          label="Lokasi perkiraan"
          value={formatNumberId(overview.totals.approximatePoints)}
          hint="Pin manual atau akurasi rendah"
          icon={Shapes}
          tone="amber"
        />
        <StatCard
          label="Faskes di peta"
          value={formatNumberId(overview.totals.sites)}
          hint={`${formatNumberId(overview.totals.stakeholdersRepresented)} menyumbang konten`}
          icon={MapPinned}
          tone="neutral"
        />
      </section>

      <MapExplorer
        key={mapKey}
        role={user.role}
        points={overview.points}
        sites={overview.sites}
        styleUrl={MAP_STYLE_URL}
      />

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Tabel sebaran</h2>
          <p className="text-xs text-ink-muted">
            Alternatif peta yang dapat dibaca keyboard dan pembaca layar.
          </p>
        </div>
        {overview.points.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            Belum ada konten berlokasi di cabang ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <caption className="sr-only">
                Daftar konten berlokasi pada cabang
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-4 py-3">
                    Konten
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Organisasi
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Lokasi
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.points.slice(0, 50).map((point) => (
                  <tr
                    key={point.id}
                    className="border-b border-border/70 align-top last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={point.href.replace("/admin/validasi", "/cabang/konten")}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {point.title ?? "(tanpa judul)"}
                      </Link>
                      <p className="text-xs text-ink-muted">{point.referenceCode}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {point.stakeholderName}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {point.locationLabel}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={point.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={point.href.replace("/admin/validasi", "/cabang/konten")}
                        className="text-sm font-medium text-brand-blue-800 underline-offset-4 hover:underline"
                      >
                        Lihat
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
