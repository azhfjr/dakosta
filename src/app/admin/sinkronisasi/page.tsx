import type { Metadata } from "next";

import { SyncPanel } from "@/components/admin/sync-panel";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { requireRole } from "@/lib/session";
import { listSyncJobs } from "@/lib/sync/jobs";

export const metadata: Metadata = {
  title: "Sinkronisasi",
};

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const admin = await requireRole("ADMIN");
  const jobs = await listSyncJobs(12);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Master Admin"
        title="Sinkronisasi"
        description="Jalankan pemeriksaan konsistensi internal: cakupan konten, invarian persetujuan, rekonsiliasi target, cache, outbox notifikasi, dan agregat analitik. Pekerjaan tercatat di basis data sehingga progres tetap ada setelah tab ditutup."
      />
      <SyncPanel initialJobs={jobs} readOnly={admin.isDemo} />
    </PageContainer>
  );
}
