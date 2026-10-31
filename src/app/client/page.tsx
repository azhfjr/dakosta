import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Info, PlusCircle } from "lucide-react";

import { KpiDashboard } from "@/components/dashboard/kpi-dashboard";
import { Button } from "@/components/ui/button";
import { recordAudit } from "@/lib/audit";
import {
  getDashboardOverview,
  getKpiFilterOptions,
  monthOptions,
  parseKpiFiltersFromParams,
} from "@/lib/kpi/sql";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Beranda stakeholder",
};

export const dynamic = "force-dynamic";

export default async function ClientHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("CLIENT");
  const params = await searchParams;
  const filters = parseKpiFiltersFromParams(params);

  if (filters.stakeholderId && !user.stakeholderIds.includes(filters.stakeholderId)) {
    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "ACCESS_DENIED",
      recordType: "STAKEHOLDER",
      recordId: filters.stakeholderId,
      after: { reason: "stakeholder_scope_mismatch", route: "/client" },
    });
    redirect("/akses-ditolak");
  }

  const [overview, options] = await Promise.all([
    getDashboardOverview(user, filters),
    getKpiFilterOptions(user),
  ]);

  const notice =
    user.stakeholderIds.length === 0 ? (
      <div className="flex items-start gap-3 rounded-xl border border-status-review/30 bg-status-review/5 p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-status-review" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Akun belum terhubung ke stakeholder
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Hubungi admin demo untuk menautkan akun Anda ke stakeholder. Tanpa
            keterkaitan, konten tidak dapat dilaporkan dan capaian akan bernilai
            nol.
          </p>
        </div>
      </div>
    ) : undefined;

  return (
    <KpiDashboard
      overview={overview}
      role="CLIENT"
      options={{ ...options, months: monthOptions(filters.month) }}
      basePath="/client"
      title={`Beranda ${user.name}`}
      description="Capaian konten stakeholder Anda pada ruang demo Bandung, dihitung hanya dari konten yang telah disetujui admin."
      contentDetailBase="/client/konten"
      stakeholderChartTitle="Stakeholder Anda"
      notice={notice}
      headerActions={
        <Button asChild className="h-10">
          <Link href="/client/lapor">
            <PlusCircle className="size-4" aria-hidden />
            Lapor konten
          </Link>
        </Button>
      }
    />
  );
}
