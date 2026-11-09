import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReviewPanel } from "@/components/admin/review-panel";
import { SubmissionDetailView } from "@/components/content/submission-detail-view";
import { STATUS_LABEL } from "@/lib/content-status";
import { AppError } from "@/lib/errors";
import { getSubmissionDetail } from "@/lib/submissions";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Tinjau konten cabang",
};

export const dynamic = "force-dynamic";

const PENDING = new Set(["SUBMITTED"]);

export default async function BranchReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("BRANCH_ADMIN");
  const { id } = await params;

  let detail;
  try {
    detail = await getSubmissionDetail(user, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const canReview = PENDING.has(detail.status);

  return (
    <SubmissionDetailView
      detail={detail}
      backHref="/cabang/review"
      backLabel="Antrean review"
      decisionNote={
        canReview
          ? undefined
          : `Konten ini berstatus ${STATUS_LABEL[detail.status]}. Panel keputusan dinonaktifkan karena konten sudah diputuskan; riwayat tetap dapat ditelusuri.`
      }
      aside={
        <ReviewPanel
          submissionId={detail.id}
          expectedVersion={detail.version}
          canReview={canReview}
          decidedStatus={STATUS_LABEL[detail.status]}
          basePath="/cabang/review"
        />
      }
    />
  );
}
