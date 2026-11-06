import type { Metadata } from "next";

import { RedNoticePanel } from "@/components/analytics/red-notice-panel";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { getRedNotice } from "@/lib/analytics/red-notice";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Red Notice wilayah",
};

export const dynamic = "force-dynamic";

export default async function RegionalRedNoticePage() {
  const user = await requireRole("REGIONAL_ADMIN");
  const data = await getRedNotice(user);

  return (
    <PageContainer>
      <PageHeader
        title="Red Notice wilayah"
        description={`Red Notice menandai Faskes aktif di ${user.scopeLabel} yang belum pernah mengirim konten sama sekali. Faskes yang aktif sebelumnya tetapi tidak mengirim pada bulan berjalan ditampilkan terpisah agar tidak tertukar.`}
      />

      <RedNoticePanel data={data} />
    </PageContainer>
  );
}
