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
  title: "Dashboard wilayah",
};

export const dynamic = "force-dynamic";

type DashboardUser = Awaited<ReturnType<typeof requireRole>>;

export default async function RegionalHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("REGIONAL_ADMIN");
  const params = await searchParams;
  redirectDashboardView("/wilayah/dashboard", params);
  const description = `Capaian konten yang telah memperoleh approval final untuk ${user.scopeLabel}. Wilayah bersifat baca-saja; keputusan tetap dilakukan admin cabang.`;

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard wilayah"
        description={description}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <Button asChild className="h-9">
            <Link href="/wilayah/kinerja">Buka kinerja wilayah</Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton label="Memuat dasbor…" />}>
        <RegionalHomeBody
          user={user}
          params={params}
          description={description}
        />
      </Suspense>
    </PageContainer>
  );
}

async function RegionalHomeBody({
  user,
  params,
  description,
}: {
  user: DashboardUser;
  params: Record<string, string | string[] | undefined>;
  description: string;
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
      basePath="/wilayah/dashboard"
      detailBase="/wilayah/konten"
      title="Dashboard wilayah"
      description={description}
      hideHeader
    />
  );
}
