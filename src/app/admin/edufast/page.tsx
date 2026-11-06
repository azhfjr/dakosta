import type { Metadata } from "next";

import { PolicyManager } from "@/components/edufast/policy-manager";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { formatDateTimeId } from "@/lib/dates";
import { listPolicies, listPolicyEvents } from "@/lib/edufast/policy";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Kebijakan EDUFAST",
};

export const dynamic = "force-dynamic";

export default async function AdminEdufastPage() {
  await requireRole("ADMIN");
  const [policies, events] = await Promise.all([
    listPolicies(),
    listPolicyEvents(20),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Kebijakan EDUFAST bulanan"
        description="Tetapkan sub-tema EDUFAST yang diizinkan per periode. Konten EDUFAST hanya dapat dikirim bila kebijakan periode tanggal konten sudah terbit. Non-EDUFAST tetap tersedia dengan enam sub-tema."
      />

      <PolicyManager
        policies={policies.map((policy) => ({
          id: policy.id,
          period: policy.period,
          status: policy.status,
          version: policy.version,
          explanation: policy.explanation,
          subThemes: policy.subThemes,
          publishedAtLabel: policy.publishedAt
            ? formatDateTimeId(policy.publishedAt)
            : null,
        }))}
        events={events.map((event) => ({
          id: event.id,
          action: event.action,
          actorId: event.actorId,
          createdAtLabel: formatDateTimeId(event.createdAt),
        }))}
      />
    </PageContainer>
  );
}
