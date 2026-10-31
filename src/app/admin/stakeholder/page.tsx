import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CheckCircle2, MapPin, Users } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatDateId, formatDateTimeId, formatNumberId } from "@/lib/dates";
import {
  getStakeholderOverview,
  STAKEHOLDER_CATEGORY_LABEL,
} from "@/lib/stakeholders";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Stakeholder",
};

export const dynamic = "force-dynamic";

export default async function AdminStakeholderPage() {
  await requireRole("ADMIN");
  const overview = await getStakeholderOverview();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Stakeholder
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Direktori stakeholder sintetis beserta lokasi terdaftar, akun klien,
          dan capaian konten disetujui. Seluruh data adalah fiktif untuk
          demonstrasi.
        </p>
      </header>

      <section
        aria-label="Ringkasan stakeholder"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Total stakeholder"
          value={formatNumberId(overview.totals.stakeholders)}
          hint="Terdaftar di workspace demo"
          icon={Building2}
          tone="blue"
        />
        <StatCard
          label="Stakeholder aktif"
          value={formatNumberId(overview.totals.active)}
          hint="Berstatus Aktif"
          icon={Users}
          tone="teal"
        />
        <StatCard
          label="Punya konten disetujui"
          value={formatNumberId(overview.totals.withApproved)}
          hint="Minimal satu konten Disetujui"
          icon={CheckCircle2}
          tone="green"
        />
        <StatCard
          label="Total konten disetujui"
          value={formatNumberId(overview.totals.approved)}
          hint="Seluruh periode"
          icon={MapPin}
          tone="neutral"
        />
      </section>

      <section
        aria-labelledby="stakeholder-daftar"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="border-b border-border px-5 py-3">
          <h2 id="stakeholder-daftar" className="text-base font-semibold text-foreground">
            Daftar stakeholder
          </h2>
          <p className="text-xs text-ink-muted">
            Diurutkan berdasarkan nama. Koordinat menandakan lokasi terdaftar,
            bukan lokasi konten.
          </p>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[68rem] border-collapse text-sm">
            <caption className="sr-only">
              Daftar stakeholder dengan kategori, lokasi, akun klien, dan konten
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                <th scope="col" className="px-5 py-3">Stakeholder</th>
                <th scope="col" className="px-5 py-3">Kategori</th>
                <th scope="col" className="px-5 py-3">Wilayah layanan</th>
                <th scope="col" className="px-5 py-3">Lokasi terdaftar</th>
                <th scope="col" className="px-5 py-3 text-right">Akun klien</th>
                <th scope="col" className="px-5 py-3 text-right">Konten</th>
                <th scope="col" className="px-5 py-3 text-right">Disetujui</th>
                <th scope="col" className="px-5 py-3">Aktivitas terakhir</th>
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Tindakan</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {overview.rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/70 align-top last:border-0"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{row.name}</p>
                    <p className="text-xs text-ink-muted">
                      Bergabung {formatDateId(row.joinedAt)}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-ink-muted">
                    <span className="block text-foreground">
                      {STAKEHOLDER_CATEGORY_LABEL[row.category] ?? row.category}
                    </span>
                    {row.faskesType ? (
                      <span className="text-xs">{row.faskesType}</span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{row.serviceArea}</td>
                  <td className="px-5 py-3 text-ink-muted">
                    <span className="block text-foreground">
                      {row.addressLabel ?? "—"}
                    </span>
                    <span className="text-xs">
                      {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)} ·{" "}
                      {row.locationPrecision === "exact" ? "presisi" : "perkiraan"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-ink-muted tabular">
                    {formatNumberId(row.clientCount)}
                  </td>
                  <td className="px-5 py-3 text-right text-ink-muted tabular">
                    {formatNumberId(row.submissionCount)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-foreground tabular">
                    {formatNumberId(row.approvedCount)}
                  </td>
                  <td className="px-5 py-3 text-ink-muted">
                    {formatDateTimeId(row.lastActivityAt)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        row.status === "ACTIVE"
                          ? "inline-flex rounded-full border border-status-approved/25 bg-status-approved/10 px-2.5 py-0.5 text-xs font-semibold text-status-approved"
                          : "inline-flex rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-ink-muted"
                      }
                    >
                      {row.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button asChild size="sm" variant="outline" className="h-9">
                      <Link href={`/admin/konten?stakeholderId=${row.id}`}>
                        Konten
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
