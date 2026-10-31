import type { Metadata } from "next";

import { ContentListView } from "@/components/content/content-list-view";
import {
  getSubmissionStatusCounts,
  listSubmissions,
} from "@/lib/submissions";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Konten wilayah",
};

export const dynamic = "force-dynamic";

export default async function RegionalContentPage() {
  const user = await requireRole("REGIONAL_ADMIN");
  const [counts, items] = await Promise.all([
    getSubmissionStatusCounts(user),
    listSubmissions(user, { limit: 100 }),
  ]);

  return (
    <ContentListView
      items={items}
      counts={counts}
      basePath="/wilayah/konten"
      title="Konten wilayah"
      description={`Seluruh konten dari organisasi di ${user.scopeLabel}. Tampilan baca-saja untuk pemantauan wilayah.`}
    />
  );
}
