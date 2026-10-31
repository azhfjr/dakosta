import type { Metadata } from "next";

import { ContentListView } from "@/components/content/content-list-view";
import { getSubmissionStatusCounts, listSubmissions } from "@/lib/submissions";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Konten cabang",
};

export const dynamic = "force-dynamic";

export default async function BranchContentPage() {
  const user = await requireRole("BRANCH_ADMIN");
  const [counts, items] = await Promise.all([
    getSubmissionStatusCounts(user),
    listSubmissions(user, { limit: 100 }),
  ]);

  return (
    <ContentListView
      items={items}
      counts={counts}
      basePath="/cabang/konten"
      title="Konten cabang"
      description={`Seluruh konten organisasi di ${user.scopeLabel}. Keputusan validasi dilakukan melalui antrean review cabang.`}
    />
  );
}
