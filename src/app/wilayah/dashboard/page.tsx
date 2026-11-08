import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { Button } from "@/components/ui/button";
import { redirectDashboardView } from "@/lib/dashboard/view";
import { formatDateTimeId } from "@/lib/dates";
import { MAP_STYLE_URL } from "@/lib/geo";
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
    <PageContainer gap="compact">
      <PageHeader
        title="Dashboard wilayah"
        description={description}
        dense
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <Button asChild className="h-9">
            <Link href="/wilayah/kinerja">Buka kinerja wilayah</Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton label="Memuat dasbor…" dense />}>
        <RegionalHomeBody user={user} params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function RegionalHomeBody({
  user,
  params,
}: {
  user: DashboardUser;
  params: Record<string, string | string[] | undefined>;
}) {
  return (
    <DashboardOverview
      user={user}
      basePath="/wilayah/dashboard"
      params={params}
      styleUrl={MAP_STYLE_URL}
    />
  );
}
