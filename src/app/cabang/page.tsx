import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { SlaQueue, type SlaTabKey } from "@/components/sla/sla-queue";
import { Button } from "@/components/ui/button";
import { formatDateTimeId } from "@/lib/dates";
import { listReviewQueue } from "@/lib/review";
import { requireRole } from "@/lib/session";
import { getActiveSlaPolicy } from "@/lib/sla";

export const metadata: Metadata = {
  title: "SLA Check cabang",
};

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): SlaTabKey {
  return value === "SUBMITTED" ||
    value === "RESUBMITTED" ||
    value === "IN_REVIEW"
    ? value
    : "ALL";
}

export default async function BranchSlaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("BRANCH_ADMIN");
  const params = await searchParams;
  const status = parseStatus(firstParam(params.status));
  const search = firstParam(params.q)?.trim().slice(0, 120) || undefined;
  const page = Math.max(Number(firstParam(params.page) ?? 1) || 1, 1);

  const [queue, policy] = await Promise.all([
    listReviewQueue(user, { status, search, page, pageSize: 15 }),
    getActiveSlaPolicy(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title="SLA Check cabang"
        description={`Antrean konten dari instansi di ${user.scopeLabel}. Anda dapat meninjau dan memutuskan konten cabang sendiri; SLA berakhir pada approval final.`}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <>
            <Button asChild variant="outline" className="h-9">
              <Link href="/cabang/dashboard">Dashboard</Link>
            </Button>
            <Button asChild className="h-9">
              <Link href="/cabang/kinerja">Kinerja</Link>
            </Button>
          </>
        }
      />

      <SlaQueue
        queue={queue}
        policy={policy}
        detailBase="/cabang/review"
        canDecide
        basePath="/cabang"
        search={search}
        status={status}
        scopeLabel={user.scopeLabel}
      />
    </div>
  );
}
