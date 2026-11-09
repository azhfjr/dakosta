import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";

import { SubmissionDetailView } from "@/components/content/submission-detail-view";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/lib/content-status";
import { AppError } from "@/lib/errors";
import { getSubmissionDetail } from "@/lib/submissions";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Detail konten cabang",
};

export const dynamic = "force-dynamic";

const PENDING = new Set(["SUBMITTED"]);

export default async function BranchContentDetailPage({
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
      backHref="/cabang/konten"
      backLabel="Konten cabang"
      decisionNote={
        canReview ? (
          <>
            Konten ini menunggu keputusan. Buka{" "}
            <Link
              href={`/cabang/review/${detail.id}`}
              className="font-medium text-brand-blue-700 underline-offset-4 hover:underline"
            >
              antrean review
            </Link>{" "}
            untuk menetapkan keputusan.
          </>
        ) : (
          `Konten berstatus ${STATUS_LABEL[detail.status]}; tampilan baca-saja.`
        )
      }
      aside={
        canReview ? (
          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm xl:sticky xl:top-6">
            <div className="flex items-center gap-2">
              <ClipboardCheck
                className="size-4 text-brand-blue-700"
                aria-hidden
              />
              <h2 className="text-base font-semibold text-foreground">
                Keputusan validasi
              </h2>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              Konten ini siap diputuskan pada lingkup cabang Anda.
            </p>
            <Button asChild className="mt-4 h-11">
              <Link href={`/cabang/review/${detail.id}`}>Tinjau konten</Link>
            </Button>
          </section>
        ) : undefined
      }
    />
  );
}
