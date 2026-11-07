import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ApprovedDashboardView } from "@/components/dashboard/approved-dashboard";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { Button } from "@/components/ui/button";
import {
  getApprovedDashboard,
  parseApprovedDashboardFilters,
} from "@/lib/analytics/dashboard";
import { redirectDashboardView } from "@/lib/dashboard/view";
import { formatDateTimeId } from "@/lib/dates";
import { getFilterOptions } from "@/lib/filters/options";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

type DashboardUser = Awaited<ReturnType<typeof requireRole>>;

const DESCRIPTION =
  "Capaian konten yang telah memperoleh approval final pada seluruh riwayat dalam cakupan akses Anda.";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("ADMIN");
  const params = await searchParams;
  redirectDashboardView("/admin", params);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description={DESCRIPTION}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <Button asChild className="h-9">
            <Link href="/admin/validasi">Buka SLA</Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton label="Memuat dasbor…" />}>
        <AdminHomeBody user={user} params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function AdminHomeBody({
  user,
  params,
}: {
  user: DashboardUser;
  params: Record<string, string | string[] | undefined>;
}) {
  const filters = parseApprovedDashboardFilters(params);
  const [data, options] = await Promise.all([
    getApprovedDashboard(user, filters),
    getFilterOptions(user),
  ]);

  return (
    <ApprovedDashboardView
      data={data}
      filters={filters}
      role={user.role}
      options={options}
      basePath="/admin"
      detailBase="/admin/konten"
      title="Dashboard"
      description={DESCRIPTION}
      hideHeader
    />
  );
}
