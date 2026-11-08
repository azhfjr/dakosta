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
    <PageContainer gap="compact">
      <PageHeader
        title="Dashboard"
        description={DESCRIPTION}
        dense
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <Button asChild className="h-9">
            <Link href="/admin/validasi">Buka SLA</Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton label="Memuat dasbor…" dense />}>
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
  return (
    <DashboardOverview
      user={user}
      basePath="/admin"
      params={params}
      styleUrl={MAP_STYLE_URL}
    />
  );
}
