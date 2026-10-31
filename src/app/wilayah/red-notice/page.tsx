import type { Metadata } from "next";

import { RedNoticePanel } from "@/components/analytics/red-notice-panel";
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
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Red Notice wilayah
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Red Notice menandai Faskes aktif di {user.scopeLabel} yang belum pernah
          mengirim konten sama sekali. Faskes yang aktif sebelumnya tetapi tidak
          mengirim pada bulan berjalan ditampilkan terpisah agar tidak tertukar.
        </p>
      </header>

      <RedNoticePanel data={data} />
    </div>
  );
}
