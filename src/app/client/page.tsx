import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Info, PlusCircle } from "lucide-react";

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
  title: "Beranda stakeholder",
};

export const dynamic = "force-dynamic";

type DashboardUser = Awaited<ReturnType<typeof requireRole>>;

const DESCRIPTION =
  "Capaian konten organisasi Anda, dihitung hanya dari konten yang telah memperoleh approval final reviewer cabang.";

export default async function ClientHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("CLIENT");
  const params = await searchParams;
  redirectDashboardView("/client", params);

  return (
    <PageContainer gap="compact">
      <PageHeader
        title={`Beranda ${user.name}`}
        description={DESCRIPTION}
        dense
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
      <Suspense fallback={<PageSkeleton label="Memuat dasbor…" dense />}>
        <ClientHomeBody user={user} params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function ClientHomeBody({
  user,
  params,
}: {
  user: DashboardUser;
  params: Record<string, string | string[] | undefined>;
}) {
  const notice =
    user.stakeholderIds.length === 0 ? (
      <div className="flex items-start gap-3 rounded-xl border border-status-review/30 bg-status-review/5 p-3 xl:p-2.5">
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
    ) : null;

  return (
    <div className="space-y-4">
      {notice}
      <DashboardOverview
        user={user}
        basePath="/client"
        params={params}
        styleUrl={MAP_STYLE_URL}
      />
    </div>
  );
}
