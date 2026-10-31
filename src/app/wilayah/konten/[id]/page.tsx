import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ReadOnlyDecisionNote,
  SubmissionDetailView,
} from "@/components/content/submission-detail-view";
import { AppError } from "@/lib/errors";
import { getSubmissionDetail } from "@/lib/submissions";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Detail konten wilayah",
};

export const dynamic = "force-dynamic";

export default async function RegionalContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("REGIONAL_ADMIN");
  const { id } = await params;

  let detail;
  try {
    detail = await getSubmissionDetail(user, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  return (
    <SubmissionDetailView
      detail={detail}
      backHref="/wilayah/konten"
      backLabel="Konten wilayah"
      decisionNote={
        <>
          <ReadOnlyDecisionNote status={detail.status} role="Admin Wilayah" />
        </>
      }
    />
  );
}
