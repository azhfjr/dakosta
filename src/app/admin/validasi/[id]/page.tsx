import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReviewPanel } from "@/components/admin/review-panel";
import { RevokePanel } from "@/components/admin/revoke-panel";
import { SubmissionDetailView } from "@/components/content/submission-detail-view";
import { isPendingStatus, STATUS_LABEL } from "@/lib/content-status";
import { AppError } from "@/lib/errors";
import { getSubmissionDetail } from "@/lib/submissions";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Tinjau konten",
};

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireRole("ADMIN");
  const { id } = await params;

  let detail;
  try {
    detail = await getSubmissionDetail(admin, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const canReview = isPendingStatus(detail.status);

  return (
    <SubmissionDetailView
      detail={detail}
      backHref="/admin/validasi"
      backLabel="Antrean validasi"
      decisionNote={
        canReview ? undefined : (
          <>
            Konten ini sudah diputuskan dengan status{" "}
            <span className="font-medium text-foreground">
              {STATUS_LABEL[detail.status]}
            </span>
            . Panel keputusan dinonaktifkan; riwayat tetap dapat ditelusuri.
          </>
        )
      }
      securityNote="Konten ini diverifikasi tanpa data pribadi, nomor identitas, atau rekam medis. Keputusan reviewer menulis ulasan, notifikasi, dan audit dalam satu transaksi."
      aside={
        <div className="space-y-4">
          <ReviewPanel
            submissionId={detail.id}
            expectedVersion={detail.version}
            canReview={canReview}
            decidedStatus={STATUS_LABEL[detail.status]}
          />
          {detail.status === "APPROVED" ? (
            <RevokePanel submissionId={detail.id} />
          ) : null}
        </div>
      }
    />
  );
}
