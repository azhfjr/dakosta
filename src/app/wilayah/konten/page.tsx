import type { Metadata } from "next";
import { Suspense } from "react";

import { ApprovedContentTable } from "@/components/content/approved-content-table";
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

export default async function RegionalContentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("REGIONAL_ADMIN");
  const params = await searchParams;
  const filters = parseKontenFilters(params);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title="Konten disetujui"
        eyebrow="Admin Wilayah"
        description={`Daftar konten tervalidasi pada ${user.scopeLabel}. Hanya konten berstatus Disetujui yang tampil; filter periode memakai tanggal persetujuan final.`}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
      />
      <Suspense fallback={<PageSkeleton label="Memuat konten disetujui…" />}>
        <RegionalContentBody user={user} filters={filters} />
      </Suspense>
    </div>
  );
}

async function RegionalContentBody({
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
      action="/wilayah/konten"
      detailBase="/wilayah/konten"
      filters={filters}
      data={data}
      options={options}
    />
  );
}
