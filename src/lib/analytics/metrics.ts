import "server-only";

import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb, schema } from "@/db";
import { contentScopePredicate } from "@/lib/authz/predicates";
import { PENDING_STATUSES } from "@/lib/content-status";
import type { SessionUser } from "@/lib/session";
import {
  monthKeyFor,
  monthRange,
  type AttributionMode,
} from "@/lib/kpi/formulas";

export { PENDING_STATUSES } from "@/lib/content-status";

export type MetricFilters = {
  month?: string;
  attribution?: AttributionMode;
};

export type ScopedMetrics = {
  month: string;
  attribution: AttributionMode;
  approved: number;
  submitted: number;
  pending: number;
  revisionRequested: number;
  rejected: number;
  approvalRate: number | null;
  contributingOrganizations: number;
  registeredFaskes: number;
  neverSubmittedFaskes: number;
  edufastApproved: number;
  nonEdufastApproved: number;
  videoApproved: number;
  infografisApproved: number;
};

function scopedWhere(user: SessionUser, extra: SQL[] = []): SQL | undefined {
  const scope = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  const parts = [eq(schema.contentSubmissions.archived, false), ...extra];
  if (scope) parts.push(scope);
  return and(...parts);
}

function attributionWhere(attribution: AttributionMode, month: string): SQL {
  const range = monthRange(month);
  return attribution === "approved_at"
    ? and(
        isNotNull(schema.contentSubmissions.approvedAt),
        gte(schema.contentSubmissions.approvedAt, range.startInstant),
        lte(schema.contentSubmissions.approvedAt, range.endInstant),
      )!
    : and(
        gte(schema.contentSubmissions.dateCreated, range.startLocal),
        lte(schema.contentSubmissions.dateCreated, range.endLocal),
      )!;
}

export async function getScopedMetrics(
  user: SessionUser,
  filters: MetricFilters = {},
): Promise<ScopedMetrics> {
  const month = filters.month ?? monthKeyFor();
  const attribution = filters.attribution ?? "date_created";
  const db = getDb();
  const monthScope = scopedWhere(user, [attributionWhere(attribution, month)]);

  const [approvedRows, statusRows, decidedRows, contributorRows, faskesRows] =
    await Promise.all([
      db
        .select({
          total: count(),
          edufast: sql<number>`count(*) filter (where ${schema.contentSubmissions.mainTheme} = 'EDUFAST')`,
          video: sql<number>`count(*) filter (where ${schema.contentSubmissions.contentType} = 'VIDEO')`,
          infografis: sql<number>`count(*) filter (where ${schema.contentSubmissions.contentType} = 'INFOGRAFIS')`,
        })
        .from(schema.contentSubmissions)
        .where(
          and(monthScope, eq(schema.contentSubmissions.status, "APPROVED")),
        ),
      db
        .select({ status: schema.contentSubmissions.status, total: count() })
        .from(schema.contentSubmissions)
        .where(scopedWhere(user))
        .groupBy(schema.contentSubmissions.status),
      db
        .select({ total: count() })
        .from(schema.contentSubmissions)
        .where(
          and(
            monthScope,
            inArray(schema.contentSubmissions.status, ["APPROVED", "REJECTED"]),
          ),
        ),
      db
        .select({
          total: countDistinct(schema.contentSubmissions.stakeholderId),
        })
        .from(schema.contentSubmissions)
        .where(
          and(
            scopedWhere(user),
            eq(schema.contentSubmissions.status, "APPROVED"),
          ),
        ),
      db
        .select({
          registered: count(),
          neverSubmitted: sql<number>`count(*) filter (where not exists (
            select 1 from ${schema.contentSubmissions}
            where ${schema.contentSubmissions.stakeholderId} = ${schema.stakeholders.id}
              and ${schema.contentSubmissions.submittedAt} is not null
          ))`,
        })
        .from(schema.stakeholders)
        .where(
          and(
            eq(schema.stakeholders.organizationType, "FASKES"),
            eq(schema.stakeholders.status, "ACTIVE"),
            organizationScope(user),
          ),
        ),
    ]);

  const approved = Number(approvedRows[0]?.total ?? 0);
  const decided = Number(decidedRows[0]?.total ?? 0);
  const statusCounts = new Map(
    statusRows.map((row) => [row.status, Number(row.total)]),
  );
  const pending = PENDING_STATUSES.reduce(
    (sum, status) => sum + (statusCounts.get(status) ?? 0),
    0,
  );

  return {
    month,
    attribution,
    approved,
    submitted:
      Number(statusCounts.get("SUBMITTED") ?? 0) +
      Number(statusCounts.get("RESUBMITTED") ?? 0),
    pending,
    revisionRequested: Number(statusCounts.get("REVISION_REQUIRED") ?? 0),
    rejected: Number(statusCounts.get("REJECTED") ?? 0),
    approvalRate:
      decided > 0 ? Math.round((approved / decided) * 1000) / 10 : null,
    contributingOrganizations: Number(contributorRows[0]?.total ?? 0),
    registeredFaskes: Number(faskesRows[0]?.registered ?? 0),
    neverSubmittedFaskes: Number(faskesRows[0]?.neverSubmitted ?? 0),
    edufastApproved: Number(approvedRows[0]?.edufast ?? 0),
    nonEdufastApproved: approved - Number(approvedRows[0]?.edufast ?? 0),
    videoApproved: Number(approvedRows[0]?.video ?? 0),
    infografisApproved: Number(approvedRows[0]?.infografis ?? 0),
  };
}

function organizationScope(user: SessionUser): SQL | undefined {
  const scope = user.scope;
  if (scope.kind === "GLOBAL") return undefined;
  if (scope.kind === "ORG") {
    return eq(schema.stakeholders.id, scope.organizationId);
  }
  if (scope.kind === "BRANCH") {
    return eq(schema.stakeholders.branchOfficeId, scope.branchId);
  }
  return scope.branchIds.length === 0
    ? sql`false`
    : inArray(schema.stakeholders.branchOfficeId, [...scope.branchIds]);
}
