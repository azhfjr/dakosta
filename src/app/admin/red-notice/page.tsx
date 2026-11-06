import type { Metadata } from "next";

import { RedNoticePanel } from "@/components/analytics/red-notice-panel";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { getRedNotice } from "@/lib/analytics/red-notice";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Red Notice",
};

export const dynamic = "force-dynamic";

export default async function AdminRedNoticePage() {
  const user = await requireRole("ADMIN");
  const data = await getRedNotice(user);

  return (
    <PageContainer>
      <PageHeader
        title="Red Notice"
        description="Faskes aktif yang belum pernah mengirim konten sama sekali ditandai Red Notice. Faskes yang hanya tidak aktif pada bulan berjalan ditampilkan terpisah agar kedua kondisi tidak tertukar."
      />

      <RedNoticePanel data={data} />
    </PageContainer>
  );
}
