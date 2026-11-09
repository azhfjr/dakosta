import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

import { ContentTable } from "@/components/content/content-table";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { listAnalyticsContents } from "@/lib/analytics/content-table";
import { STATUS_LABEL } from "@/lib/content-status";
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

export default async function ClientContentListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("CLIENT");
  const params = await searchParams;
  const filters = parseKontenFilters(params, "all");

  const [data, options] = await Promise.all([
    listAnalyticsContents(user, toAnalyticsFilters(filters)),
    getFilterOptions(user),
  ]);
  const exportQuery = kontenExportQuery(filters);

  return (
    <PageContainer>
      <PageHeader
        title="Detail Konten"
        description="Seluruh konten organisasi Anda, termasuk draf, konten berjalan, dan riwayat keputusan."
        meta="Ekspor mengikuti seluruh filter aktif."
        actions={
          <Button asChild className="h-10 sm:h-9">
            <Link href="/client/lapor">
              <PlusCircle className="size-4" aria-hidden />
              Lapor konten
            </Link>
          </Button>
        }
      />

      <ContentTable
        action="/client/konten"
        detailBase="/client/konten"
        filters={filters}
        data={data}
        options={options}
        showStakeholderFilter={false}
        exportHref={`/api/v1/exports/submissions${exportQuery}`}
        pdfHref={`/api/v1/reports/contents${exportQuery}`}
        emptyNote="Mulai dengan melaporkan konten pertama Anda."
      />

      <p className="text-xs leading-relaxed text-ink-muted">
        Hanya konten berstatus {STATUS_LABEL.APPROVED} yang dihitung dalam
        capaian. Draf, konten yang ditolak, perlu revisi, dicabut, atau
        diarsipkan tidak menambah angka.
      </p>
    </PageContainer>
  );
}
