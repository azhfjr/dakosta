import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { and, count, eq } from "drizzle-orm";
import { Info, PlusCircle, RotateCcw } from "lucide-react";

import { KpiDashboard } from "@/components/dashboard/kpi-dashboard";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { Button } from "@/components/ui/button";
import { getDb, schema } from "@/db";
import { getDashboardAnalytics } from "@/lib/analytics/charts";
import { recordAudit } from "@/lib/audit";
import { contentScopePredicate } from "@/lib/authz/predicates";
import { redirectDashboardView } from "@/lib/dashboard/view";
import { formatDateTimeId, formatNumberId } from "@/lib/dates";
import { getFilterOptions } from "@/lib/filters/options";
import { getDashboardOverview, parseKpiFiltersFromParams } from "@/lib/kpi/sql";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Beranda stakeholder",
};

export const dynamic = "force-dynamic";

type DashboardUser = Awaited<ReturnType<typeof requireRole>>;

export default async function ClientHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("CLIENT");
  const params = await searchParams;
  const filters = parseKpiFiltersFromParams(params);
  redirectDashboardView("/client", params);

  if (
    filters.stakeholderId &&
    !user.stakeholderIds.includes(filters.stakeholderId)
  ) {
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

  return (
    <PageContainer>
      <PageHeader
        title={`Beranda ${user.name}`}
        description="Capaian konten organisasi Anda, dihitung hanya dari konten yang telah disetujui reviewer cabang. Dasar tanggal default adalah tanggal konten."
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <Button asChild className="h-10">
            <Link href="/client/lapor">
              <PlusCircle className="size-4" aria-hidden />
              Lapor konten
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton label="Memuat dasbor…" />}>
        <ClientHomeBody user={user} filters={filters} />
      </Suspense>
    </PageContainer>
  );
}

async function ClientHomeBody({
  user,
  filters,
}: {
  user: DashboardUser;
  filters: ReturnType<typeof parseKpiFiltersFromParams>;
}) {
  const [overview, options, analytics, revisionCount] = await Promise.all([
    getDashboardOverview(user, filters),
    getFilterOptions(user),
    getDashboardAnalytics(
      user,
      { ...filters, sources: [] },
      { rankingLevel: null },
    ),
    (async () => {
      const scope = contentScopePredicate(
        user,
        schema.contentSubmissions.stakeholderId,
      );
      const [row] = await getDb()
        .select({ total: count() })
        .from(schema.contentSubmissions)
        .where(
          and(
            eq(schema.contentSubmissions.status, "REVISION_REQUIRED"),
            ...(scope ? [scope] : []),
          ),
        );
      return Number(row?.total ?? 0);
    })(),
  ]);

  const notice =
    user.stakeholderIds.length === 0 ? (
      <div className="flex items-start gap-3 rounded-xl border border-status-review/30 bg-status-review/5 p-4">
        <Info
          className="mt-0.5 size-5 shrink-0 text-status-review"
          aria-hidden
        />
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Akun belum terhubung ke stakeholder
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Hubungi Master Admin untuk menautkan akun Anda ke organisasi. Tanpa
            keterkaitan, konten tidak dapat dilaporkan dan capaian akan bernilai
            nol.
          </p>
        </div>
      </div>
    ) : undefined;

  return (
    <div className="space-y-6">
      {revisionCount > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-status-revision/30 bg-status-revision/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <RotateCcw
              className="mt-0.5 size-5 shrink-0 text-status-revision"
              aria-hidden
            />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {formatNumberId(revisionCount)} konten perlu revisi
              </h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                Perbaiki konten lalu kirim ulang agar dapat divalidasi kembali.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-10">
            <Link href="/client/konten?status=REVISION_REQUIRED">
              Buka daftar revisi
            </Link>
          </Button>
        </div>
      ) : null}

      <KpiDashboard
        overview={overview}
        analytics={analytics}
        role={user.role}
        options={{
          stakeholders: options.stakeholders,
          subThemes: options.subThemes,
        }}
        basePath="/client"
        title={`Beranda ${user.name}`}
        description="Capaian konten organisasi Anda, dihitung hanya dari konten yang telah disetujui reviewer cabang. Dasar tanggal default adalah tanggal konten."
        contentDetailBase="/client/konten"
        notice={notice}
        hideHeader
      />
    </div>
  );
}
