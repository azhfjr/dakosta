import type { Metadata } from "next";
import { Suspense } from "react";

import { ApprovedContentTable } from "@/components/content/approved-content-table";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { listAnalyticsContents } from "@/lib/analytics/content-table";
import { formatDateTimeId } from "@/lib/dates";
import { parseKontenFilters, toAnalyticsFilters } from "@/lib/filters/konten";
import { getFilterOptions } from "@/lib/filters/options";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Konten disetujui",
};

export const dynamic = "force-dynamic";

type ContentUser = Awaited<ReturnType<typeof requireRole>>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BranchContentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("BRANCH_ADMIN");
  const params = await searchParams;
  const filters = parseKontenFilters(params);

  return (
    <PageContainer>
      <PageHeader
        title="Konten disetujui"
        eyebrow="Admin Cabang"
        description={`Daftar konten tervalidasi pada ${user.scopeLabel}. Hanya konten berstatus Disetujui yang tampil; filter periode memakai tanggal persetujuan final.`}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
      />
      <Suspense fallback={<PageSkeleton label="Memuat konten disetujui…" />}>
        <BranchContentBody user={user} filters={filters} />
      </Suspense>
    </PageContainer>
  );
}

async function BranchContentBody({
  user,
  filters,
}: {
  user: ContentUser;
  filters: ReturnType<typeof parseKontenFilters>;
}) {
  const [data, options] = await Promise.all([
    listAnalyticsContents(user, toAnalyticsFilters(filters)),
    getFilterOptions(user),
  ]);

  return (
    <ApprovedContentTable
      action="/cabang/konten"
      detailBase="/cabang/konten"
      filters={filters}
      data={data}
      options={options}
    />
  );
}
