import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, MapPinned, Shapes, Target } from "lucide-react";

import { MapExplorer } from "@/components/map/map-explorer";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/content/status-badge";
import { FilterBar, type FilterField } from "@/components/filters/filter-bar";
import { Button } from "@/components/ui/button";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { getFilterOptions } from "@/lib/filters/options";
import { MAP_STYLE_URL } from "@/lib/geo";
import { getMapOverview, parseMapFilters, type MapStatus } from "@/lib/map";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Peta sebaran",
};

export const dynamic = "force-dynamic";

const STATUS_TABS: Array<{ key: MapStatus; label: string }> = [
  { key: "ALL", label: "Semua" },
  { key: "APPROVED", label: "Disetujui" },
  { key: "SUBMITTED", label: "Terkirim" },
  { key: "IN_REVIEW", label: "Ditinjau" },
];

export default async function AdminMapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;
  const filters = parseMapFilters(params);

  const [overview, options] = await Promise.all([
    getMapOverview(admin, filters),
    getFilterOptions(admin),
  ]);

  const mapKey = `${filters.stakeholderId ?? "all"}-${filters.subTheme ?? "all"}-${filters.status}`;
  const filterFields: FilterField[] = [
    {
      kind: "select",
      name: "status",
      label: "Status konten",
      value: filters.status === "ALL" ? "" : filters.status,
      options: STATUS_TABS.filter((tab) => tab.key !== "ALL").map((tab) => ({
        value: tab.key,
        label: tab.label,
      })),
      allLabel: "Semua status",
    },
    {
      kind: "select",
      name: "stakeholderId",
      label: "Stakeholder",
      value: filters.stakeholderId ?? "",
      options: options.stakeholders,
      allLabel: "Semua stakeholder",
    },
    {
      kind: "select",
      name: "subTheme",
      label: "Sub-tema",
      value: filters.subTheme ?? "",
      options: options.subThemes,
      allLabel: "Semua sub-tema",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Peta sebaran konten
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Bandingkan lokasi konten yang dilaporkan dengan lokasi stakeholder
            terdaftar. Lokasi berpresisi rendah ditampilkan sebagai cincin untuk
            menandakan perkiraan.
          </p>
        </div>
        <p className="text-xs text-ink-muted">
          Diperbarui {formatDateTimeId(overview.generatedAt)} WIB
        </p>
      </header>

      <section
        aria-label="Ringkasan sebaran"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Titik konten"
          value={formatNumberId(overview.totals.points)}
          hint="Konten non-draf pada filter ini"
          icon={MapPin}
          tone="blue"
        />
        <StatCard
          label="Lokasi presisi"
          value={formatNumberId(overview.totals.exactPoints)}
          hint="Perangkat GPS dengan akurasi ≤ 100 m"
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
          label="Stakeholder di peta"
          value={formatNumberId(overview.totals.sites)}
          hint={`${formatNumberId(overview.totals.stakeholdersRepresented)} menyumbang konten`}
          icon={MapPinned}
          tone="neutral"
        />
      </section>

      <FilterBar
        action="/admin/peta"
        label="Filter sebaran"
        idPrefix="peta"
        resetHref="/admin/peta"
        fields={filterFields}
        summary="Angka pada kartu, peta, dan tabel selalu memakai filter yang sama."
      />

      {overview.truncated ? (
        <p
          role="status"
          className="rounded-lg border border-status-revision/30 bg-status-revision/10 px-4 py-3 text-sm text-status-revision"
        >
          Peta menampilkan 500 titik terbaru. Tabel di bawah juga dibatasi pada
          jumlah tersebut; persempit filter untuk melihat data lain.
        </p>
      ) : null}

      <MapExplorer
        key={mapKey}
        role={admin.role}
        points={overview.points}
        sites={overview.sites}
        styleUrl={MAP_STYLE_URL}
      />

      <section
        id="tabel-peta"
        aria-labelledby="tabel-peta-judul"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="tabel-peta-judul"
            className="text-base font-semibold text-foreground"
          >
            Tabel sebaran konten
          </h2>
          <p className="text-xs text-ink-muted">
            Alternatif peta yang dapat dibaca keyboard dan pembaca layar.
          </p>
        </div>
        {overview.points.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-muted">
            Tidak ada konten berlokasi pada filter ini.
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[60rem] border-collapse text-sm">
              <caption className="sr-only">
                Daftar konten dengan lokasi dan tingkat presisi
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th scope="col" className="px-5 py-3">
                    Konten
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Stakeholder
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Lokasi
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Presisi
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Diperbarui
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Tindakan</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.points.map((point) => (
                  <tr
                    key={point.id}
                    className="border-b border-border/70 align-top last:border-0"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={point.href}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {point.title ?? "(tanpa judul)"}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {point.referenceCode}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {point.stakeholderName}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      <span className="block text-foreground">
                        {point.locationLabel}
                      </span>
                      <span className="text-xs">
                        {point.latitude.toFixed(5)},{" "}
                        {point.longitude.toFixed(5)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          point.precision === "exact"
                            ? "inline-flex rounded-full border border-status-approved/25 bg-status-approved/10 px-2.5 py-0.5 text-xs font-semibold text-status-approved"
                            : "inline-flex rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-ink-muted"
                        }
                      >
                        {point.precision === "exact" ? "Presisi" : "Perkiraan"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={point.status} />
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {formatDateTimeId(point.updatedAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-9"
                      >
                        <Link href={point.href}>Buka</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-ink-muted">
        Basemap: OpenFreeMap Positron (dapat diganti lewat{" "}
        <code className="rounded bg-surface-muted px-1 py-0.5">
          NEXT_PUBLIC_MAP_STYLE_URL
        </code>
        ). Koordinat menandai lokasi organisasi, bukan lokasi pribadi.
      </p>
    </div>
  );
}
