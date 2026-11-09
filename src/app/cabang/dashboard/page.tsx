import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DashboardExportButton } from "@/components/dashboard/dashboard-export-button";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { Button } from "@/components/ui/button";
import { redirectDashboardView } from "@/lib/dashboard/view";
import { dashboardVariant } from "@/lib/dashboard/variant";
import { formatDateTimeId } from "@/lib/dates";
import { MAP_STYLE_URL } from "@/lib/geo";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard cabang",
};

export const dynamic = "force-dynamic";

type DashboardUser = Awaited<ReturnType<typeof requireRole>>;

const DESCRIPTION =
  "Capaian konten yang telah memperoleh approval final pada seluruh riwayat dalam cakupan cabang Anda.";

export default async function BranchHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("BRANCH_ADMIN");
  const params = await searchParams;
  redirectDashboardView(
    "/cabang/dashboard",
    params,
    dashboardVariant(user.role),
  );

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard cabang"
        description={`${DESCRIPTION} ${user.scopeLabel}`}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <>
            <DashboardExportButton params={params} className="h-10 sm:h-9" />
            <Button asChild className="h-10 sm:h-9">
              <Link href="/cabang">Cek SLA cabang</Link>
            </Button>
          </>
        }
      />
      <Suspense fallback={<PageSkeleton label="Memuat dasbor…" />}>
        <BranchHomeBody user={user} params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function BranchHomeBody({
  user,
  params,
}: {
  user: DashboardUser;
  params: Record<string, string | string[] | undefined>;
}) {
  return (
    <DashboardOverview
      user={user}
      basePath="/cabang/dashboard"
      params={params}
      styleUrl={MAP_STYLE_URL}
    />
  );
}
