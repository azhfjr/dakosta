import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ContentTable } from "@/components/content/content-table";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { Button } from "@/components/ui/button";
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

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;
  const filters = parseKontenFilters(params, "all");

  return (
    <PageContainer>
      <PageHeader
        title="Detail Konten"
        eyebrow="Master Admin"
        description="Arsip seluruh konten lintas stakeholder beserta status, keputusan, dan versi terakhirnya. Hanya status Disetujui yang dihitung dalam capaian."
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <Button asChild variant="outline" className="h-10 sm:h-9">
            <Link href="/admin/konten/impor">Impor konten</Link>
          </Button>
        }
      />
      <Suspense fallback={<PageSkeleton label="Memuat detail konten…" />}>
        <AdminContentBody admin={admin} filters={filters} />
      </Suspense>
    </PageContainer>
  );
}

async function AdminContentBody({
  admin,
  filters,
}: {
  admin: ContentUser;
  filters: ReturnType<typeof parseKontenFilters>;
}) {
  const [data, options] = await Promise.all([
    listAnalyticsContents(admin, toAnalyticsFilters(filters)),
    getFilterOptions(admin),
  ]);
  const exportQuery = kontenExportQuery(filters);

  return (
    <ContentTable
      action="/admin/konten"
      detailBase="/admin/validasi"
      filters={filters}
      data={data}
      options={options}
      exportHref={`/api/v1/exports/submissions${exportQuery}`}
      pdfHref={`/api/v1/reports/contents${exportQuery}`}
    />
  );
}
