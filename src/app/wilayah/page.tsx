import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { SlaQueue, type SlaTabKey } from "@/components/sla/sla-queue";
import { Button } from "@/components/ui/button";
import { formatDateTimeId } from "@/lib/dates";
import { getFilterOptions } from "@/lib/filters/options";
import {
  firstParam,
  parseFilterSubTheme,
  parseFilterUuid,
} from "@/lib/filters/query";
import { listReviewQueue } from "@/lib/review";
import { requireRole } from "@/lib/session";
import { getActiveSlaPolicy } from "@/lib/sla";

export const metadata: Metadata = {
  title: "SLA Check wilayah",
};

export const dynamic = "force-dynamic";

function parseStatus(value: string | undefined): SlaTabKey {
  return value === "SUBMITTED" ||
    value === "RESUBMITTED" ||
    value === "IN_REVIEW"
    ? value
    : "ALL";
}

export default async function RegionalSlaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("REGIONAL_ADMIN");
  const params = await searchParams;
  const status = parseStatus(firstParam(params, "status"));
  const search = firstParam(params, "q")?.slice(0, 120) || undefined;
  const page = Math.max(Number(firstParam(params, "page") ?? 1) || 1, 1);
  const stakeholderId =
    parseFilterUuid(firstParam(params, "stakeholderId")) ?? undefined;
  const subTheme =
    parseFilterSubTheme(firstParam(params, "subTheme")) ?? undefined;

  const [queue, policy, options] = await Promise.all([
    listReviewQueue(user, {
      status,
      search,
      page,
      pageSize: 15,
      stakeholderId,
      subTheme,
    }),
    getActiveSlaPolicy(),
    getFilterOptions(user),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="SLA Check wilayah"
        description={`Pantau antrean, usia, dan status keputusan konten di ${user.scopeLabel}. Kedeputian bersifat baca-saja: keputusan tetap dilakukan Admin Cabang.`}
        meta={`Diperbarui ${formatDateTimeId(new Date())} WIB`}
        actions={
          <>
            <Button asChild variant="outline" className="h-9">
              <Link href="/wilayah/dashboard">Dashboard</Link>
            </Button>
            <Button asChild className="h-9">
              <Link href="/wilayah/kinerja">Kinerja</Link>
            </Button>
          </>
        }
      />

      <SlaQueue
        queue={queue}
        policy={policy}
        detailBase="/wilayah/konten"
        canDecide={false}
        basePath="/wilayah"
        search={search}
        status={status}
        stakeholderId={stakeholderId}
        subTheme={subTheme}
        options={{
          stakeholders: options.stakeholders,
          subThemes: options.subThemes,
        }}
        scopeLabel={user.scopeLabel}
        readOnlyNote="Mode pantau: tindakan approval/revisi hanya untuk Admin Cabang."
      />
    </PageContainer>
  );
}
