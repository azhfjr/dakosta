import type { Metadata } from "next";

import { RedNoticePanel } from "@/components/analytics/red-notice-panel";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { getRedNotice } from "@/lib/analytics/red-notice";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Red Notice cabang",
};

export const dynamic = "force-dynamic";

export default async function BranchRedNoticePage() {
  const user = await requireRole("BRANCH_ADMIN");
  const data = await getRedNotice(user);

  return (
    <PageContainer>
      <PageHeader
        title="Red Notice cabang"
        description={`Faskes aktif di ${user.scopeLabel} yang belum pernah mengirim konten. Daftar Faskes yang hanya tidak aktif pada bulan berjalan ditampilkan terpisah.`}
      />

      <RedNoticePanel data={data} />
    </PageContainer>
  );
}
