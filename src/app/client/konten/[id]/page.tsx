import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SubmissionDetailView } from "@/components/content/submission-detail-view";
import { Button } from "@/components/ui/button";
import { formatDateTimeId } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/session";
import { getSubmissionDetail } from "@/lib/submissions";

export const metadata: Metadata = {
  title: "Detail konten",
};

export const dynamic = "force-dynamic";

export default async function ClientContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("CLIENT");
  const { id } = await params;

  let detail;
  try {
    detail = await getSubmissionDetail(user, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    if (error instanceof AppError && error.status === 403)
      redirect("/akses-ditolak");
    throw error;
  }

  const editable =
    detail.status === "DRAFT" || detail.status === "REVISION_REQUIRED";

  return (
    <SubmissionDetailView
      detail={detail}
      backHref="/client/konten"
      backLabel="Kembali ke daftar konten"
      actions={
        editable ? (
          <Button asChild className="h-10">
            <Link href={`/client/lapor?submissionId=${detail.id}`}>
              {detail.status === "DRAFT"
                ? "Lanjutkan draf"
                : "Perbaiki & kirim ulang"}
            </Link>
          </Button>
        ) : undefined
      }
      decisionNote={
        detail.decisionReason ? (
          <>
            <span className="font-medium text-foreground">
              Catatan keputusan admin:
            </span>{" "}
            {detail.decisionReason}
          </>
        ) : undefined
      }
      aside={
        <aside className="space-y-4">
          <section
            aria-labelledby="riwayat-title"
            className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5 xl:sticky xl:top-6"
          >
            <h2
              id="riwayat-title"
              className="text-base font-semibold text-foreground"
            >
              Riwayat
            </h2>
            <ol className="mt-4 space-y-4">
              {detail.timeline.map((entry, index) => (
                <li key={entry.key} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={[
                        "mt-1 size-2.5 rounded-full",
                        index === detail.timeline.length - 1
                          ? "bg-brand-blue-700"
                          : "bg-border",
                      ].join(" ")}
                      aria-hidden
                    />
                    {index < detail.timeline.length - 1 ? (
                      <span
                        className="mt-1 h-full w-px bg-border"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 pb-1">
                    <p className="text-sm font-medium text-foreground">
                      {entry.label}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed break-words text-ink-muted">
                      {entry.description}
                    </p>
                    <p className="mt-1 text-xs whitespace-nowrap text-ink-muted tabular">
                      {formatDateTimeId(entry.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      }
    />
  );
}
