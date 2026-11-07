import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentTable } from "@/components/content/content-table";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { listAnalyticsContents } from "@/lib/analytics/content-table";
import { formatDateTimeId } from "@/lib/dates";
import {
  kontenExportQuery,
  parseKontenFilters,
  toAnalyticsFilters,
} from "@/lib/filters/konten";
import { getFilterOptions } from "@/lib/filters/options";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Detail Konten",
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
  const filters = parseKontenFilters(params, "all");

  return (
    <PageContainer>
      <PageHeader
        title="Detail Konten"
        eyebrow="Admin Wilayah"
        description={`Seluruh konten pada ${user.scopeLabel}, termasuk draf, konten berjalan, dan keputusan akhir. Hanya status Disetujui yang dihitung dalam capaian.`}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
      />
      <Suspense fallback={<PageSkeleton label="Memuat detail konten…" />}>
        <RegionalContentBody user={user} filters={filters} />
      </Suspense>
    </PageContainer>
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
  const exportQuery = kontenExportQuery(filters);

  return (
    <ContentTable
      action="/wilayah/konten"
      detailBase="/wilayah/konten"
      filters={filters}
      data={data}
      options={options}
      exportHref={`/api/v1/exports/submissions${exportQuery}`}
      pdfHref={`/api/v1/reports/contents${exportQuery}`}
    />
  );
}
