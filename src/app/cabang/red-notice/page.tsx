import type { Metadata } from "next";

import { RedNoticePanel } from "@/components/analytics/red-notice-panel";
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
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Red Notice cabang
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Faskes aktif di {user.scopeLabel} yang belum pernah mengirim konten.
          Daftar Faskes yang hanya tidak aktif pada bulan berjalan ditampilkan
          terpisah.
        </p>
      </header>

      <RedNoticePanel data={data} />
    </div>
  );
}
