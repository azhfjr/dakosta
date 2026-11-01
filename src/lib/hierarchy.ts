import "server-only";

import {
  and,
  asc,
  count,
  countDistinct,
  eq,
  inArray,
  isNotNull,
  sql,
} from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  organizationScopePredicate,
  regionScopePredicate,
} from "@/lib/authz/predicates";
import type { Scope } from "@/lib/authz/types";

export type RegionSummary = {
  id: string;
  code: string;
  name: string;
  status: string;
  branchCount: number;
  organizationCount: number;
  faskesCount: number;
  contentCount: number;
  approvedCount: number;
  pendingCount: number;
};

export type BranchSummary = {
  id: string;
  code: string;
  name: string;
  status: string;
  regionId: string;
  regionName: string;
  organizationCount: number;
  faskesCount: number;
  contentCount: number;
  approvedCount: number;
  pendingCount: number;
  reviewerCount: number;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  organizationType: string;
  faskesClass: string | null;
  faskesCode: string | null;
  category: string;
  serviceArea: string;
  addressLabel: string | null;
  status: string;
  branchId: string | null;
  branchName: string | null;
  regionId: string | null;
  regionName: string | null;
  latitude: number;
  longitude: number;
  joinedAt: string;
  contentCount: number;
  submittedCount: number;
  approvedCount: number;
  pendingCount: number;
  lastSubmittedAt: Date | null;
  accountCount: number;
};

async function contentStatsByOrganization(): Promise<
  Map<
    string,
    {
      total: number;
      submitted: number;
      approved: number;
      pending: number;
      lastSubmittedAt: Date | null;
    }
  >
> {
  const rows = await getDb()
    .select({
      organizationId: schema.contentSubmissions.stakeholderId,
      total: count(),
      submitted: sql<number>`count(*) filter (where ${schema.contentSubmissions.submittedAt} is not null)`,
      approved: sql<number>`count(*) filter (where ${schema.contentSubmissions.status} = 'APPROVED')`,
      pending: sql<number>`count(*) filter (where ${schema.contentSubmissions.status} in ('SUBMITTED','IN_REVIEW','RESUBMITTED'))`,
      lastSubmittedAt: sql<Date | null>`max(${schema.contentSubmissions.submittedAt})`,
    })
    .from(schema.contentSubmissions)
    .where(eq(schema.contentSubmissions.archived, false))
    .groupBy(schema.contentSubmissions.stakeholderId);

  return new Map(
    rows.map((row) => [
      row.organizationId,
      {
        total: Number(row.total),
        submitted: Number(row.submitted),
        approved: Number(row.approved),
        pending: Number(row.pending),
        lastSubmittedAt: row.lastSubmittedAt
          ? new Date(row.lastSubmittedAt)
          : null,
      },
    ]),
  );
}

export async function listOrganizations(
  scope: Scope,
  options: { branchId?: string; regionId?: string } = {},
): Promise<OrganizationSummary[]> {
  const predicate = organizationScopePredicate(scope, {
    id: schema.stakeholders.id,
    branchId: schema.stakeholders.branchOfficeId,
  });

  const conditions: ReturnType<typeof eq>[] = [];
  if (predicate) conditions.push(predicate);
  if (options.branchId) {
    conditions.push(eq(schema.stakeholders.branchOfficeId, options.branchId));
  }
  if (options.regionId) {
    conditions.push(
      eq(schema.branchOffices.regionalOfficeId, options.regionId),
    );
  }

  const rows = await getDb()
    .select({
      id: schema.stakeholders.id,
      name: schema.stakeholders.name,
      organizationType: schema.stakeholders.organizationType,
      faskesClass: schema.stakeholders.faskesClass,
      faskesCode: schema.stakeholders.faskesCode,
      category: schema.stakeholders.category,
      serviceArea: schema.stakeholders.serviceArea,
      addressLabel: schema.stakeholders.addressLabel,
      status: schema.stakeholders.status,
      branchId: schema.stakeholders.branchOfficeId,
      branchName: schema.branchOffices.name,
      regionId: schema.regionalOffices.id,
      regionName: schema.regionalOffices.name,
      latitude: schema.stakeholders.latitude,
      longitude: schema.stakeholders.longitude,
      joinedAt: schema.stakeholders.joinedAt,
    })
    .from(schema.stakeholders)
    .leftJoin(
      schema.branchOffices,
      eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
    )
    .leftJoin(
      schema.regionalOffices,
      eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
    )
    .where(and(...conditions))
    .orderBy(asc(schema.stakeholders.name));

  const [stats, accountRows] = await Promise.all([
    contentStatsByOrganization(),
    getDb()
      .select({
        organizationId: schema.userMemberships.organizationId,
        total: countDistinct(schema.userMemberships.userId),
      })
      .from(schema.userMemberships)
      .where(
        sql`${schema.userMemberships.revokedAt} is null and ${schema.userMemberships.organizationId} is not null`,
      )
      .groupBy(schema.userMemberships.organizationId),
  ]);
  const accounts = new Map(
    accountRows
      .filter((row) => row.organizationId)
      .map((row) => [row.organizationId as string, Number(row.total)]),
  );

  return rows.map((row) => {
    const stat = stats.get(row.id);
    return {
      ...row,
      contentCount: stat?.total ?? 0,
      submittedCount: stat?.submitted ?? 0,
      approvedCount: stat?.approved ?? 0,
      pendingCount: stat?.pending ?? 0,
      lastSubmittedAt: stat?.lastSubmittedAt ?? null,
      accountCount: accounts.get(row.id) ?? 0,
    };
  });
}

async function organizationCountsByBranch(): Promise<
  Map<string, { organizations: number; faskes: number }>
> {
  const rows = await getDb()
    .select({
      branchId: schema.stakeholders.branchOfficeId,
      total: count(),
      faskes: sql<number>`count(*) filter (where ${schema.stakeholders.organizationType} = 'FASKES')`,
    })
    .from(schema.stakeholders)
    .groupBy(schema.stakeholders.branchOfficeId);

  return new Map(
    rows
      .filter((row) => row.branchId)
      .map((row) => [
        row.branchId as string,
        { organizations: Number(row.total), faskes: Number(row.faskes) },
      ]),
  );
}

async function contentStatsByBranch(): Promise<
  Map<string, { total: number; approved: number; pending: number }>
> {
  const rows = await getDb()
    .select({
      branchId: schema.stakeholders.branchOfficeId,
      total: count(),
      approved: sql<number>`count(*) filter (where ${schema.contentSubmissions.status} = 'APPROVED')`,
      pending: sql<number>`count(*) filter (where ${schema.contentSubmissions.status} in ('SUBMITTED','IN_REVIEW','RESUBMITTED'))`,
    })
    .from(schema.contentSubmissions)
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    )
    .where(eq(schema.contentSubmissions.archived, false))
    .groupBy(schema.stakeholders.branchOfficeId);

  return new Map(
    rows
      .filter((row) => row.branchId)
      .map((row) => [
        row.branchId as string,
        {
          total: Number(row.total),
          approved: Number(row.approved),
          pending: Number(row.pending),
        },
      ]),
  );
}

export async function listBranches(scope: Scope): Promise<BranchSummary[]> {
  const scopePredicate = regionScopePredicate(
    scope,
    schema.branchOffices.regionalOfficeId,
  );
  const conditions = [eq(schema.branchOffices.status, "ACTIVE")];
  if (scopePredicate) conditions.push(scopePredicate);
  // ORG scope: only its own branch is meaningful.
  if (scope.kind === "ORG") {
    if (!scope.branchId) return [];
    conditions.push(eq(schema.branchOffices.id, scope.branchId));
  }

  const rows = await getDb()
    .select({
      id: schema.branchOffices.id,
      code: schema.branchOffices.code,
      name: schema.branchOffices.name,
      status: schema.branchOffices.status,
      regionId: schema.regionalOffices.id,
      regionName: schema.regionalOffices.name,
    })
    .from(schema.branchOffices)
    .innerJoin(
      schema.regionalOffices,
      eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
    )
    .where(and(...conditions))
    .orderBy(asc(schema.branchOffices.name));

  const [orgCounts, contentCounts, reviewerRows] = await Promise.all([
    organizationCountsByBranch(),
    contentStatsByBranch(),
    getDb()
      .select({
        branchId: schema.userMemberships.branchOfficeId,
        total: countDistinct(schema.userMemberships.userId),
      })
      .from(schema.userMemberships)
      .where(
        sql`${schema.userMemberships.revokedAt} is null and ${schema.userMemberships.role} = 'BRANCH_ADMIN'`,
      )
      .groupBy(schema.userMemberships.branchOfficeId),
  ]);
  const reviewers = new Map(
    reviewerRows
      .filter((row) => row.branchId)
      .map((row) => [row.branchId as string, Number(row.total)]),
  );

  return rows.map((row) => {
    const org = orgCounts.get(row.id);
    const content = contentCounts.get(row.id);
    return {
      ...row,
      organizationCount: org?.organizations ?? 0,
      faskesCount: org?.faskes ?? 0,
      contentCount: content?.total ?? 0,
      approvedCount: content?.approved ?? 0,
      pendingCount: content?.pending ?? 0,
      reviewerCount: reviewers.get(row.id) ?? 0,
    };
  });
}

export async function listRegions(scope: Scope): Promise<RegionSummary[]> {
  const conditions = [eq(schema.regionalOffices.status, "ACTIVE")];
  if (scope.kind === "REGION") {
    conditions.push(eq(schema.regionalOffices.id, scope.regionId));
  }
  if (scope.kind === "BRANCH" || scope.kind === "ORG") {
    if (!scope.regionId) return [];
    conditions.push(eq(schema.regionalOffices.id, scope.regionId));
  }

  const rows = await getDb()
    .select({
      id: schema.regionalOffices.id,
      code: schema.regionalOffices.code,
      name: schema.regionalOffices.name,
      status: schema.regionalOffices.status,
    })
    .from(schema.regionalOffices)
    .where(and(...conditions))
    .orderBy(asc(schema.regionalOffices.name));

  const regionIds = rows.map((row) => row.id);
  if (regionIds.length === 0) return [];

  const [branchRows, orgRows, contentRows] = await Promise.all([
    getDb()
      .select({
        regionId: schema.branchOffices.regionalOfficeId,
        total: count(),
      })
      .from(schema.branchOffices)
      .where(inArray(schema.branchOffices.regionalOfficeId, regionIds))
      .groupBy(schema.branchOffices.regionalOfficeId),
    getDb()
      .select({
        regionId: schema.branchOffices.regionalOfficeId,
        total: count(),
        faskes: sql<number>`count(*) filter (where ${schema.stakeholders.organizationType} = 'FASKES')`,
      })
      .from(schema.stakeholders)
      .innerJoin(
        schema.branchOffices,
        eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
      )
      .where(inArray(schema.branchOffices.regionalOfficeId, regionIds))
      .groupBy(schema.branchOffices.regionalOfficeId),
    getDb()
      .select({
        regionId: schema.branchOffices.regionalOfficeId,
        total: count(),
        approved: sql<number>`count(*) filter (where ${schema.contentSubmissions.status} = 'APPROVED')`,
        pending: sql<number>`count(*) filter (where ${schema.contentSubmissions.status} in ('SUBMITTED','IN_REVIEW','RESUBMITTED'))`,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .innerJoin(
        schema.branchOffices,
        eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
      )
      .where(
        and(
          inArray(schema.branchOffices.regionalOfficeId, regionIds),
          eq(schema.contentSubmissions.archived, false),
        ),
      )
      .groupBy(schema.branchOffices.regionalOfficeId),
  ]);

  const branches = new Map(
    branchRows.map((row) => [row.regionId, Number(row.total)]),
  );
  const orgs = new Map(orgRows.map((row) => [row.regionId, row]));
  const contents = new Map(contentRows.map((row) => [row.regionId, row]));

  return rows.map((row) => ({
    ...row,
    branchCount: branches.get(row.id) ?? 0,
    organizationCount: Number(orgs.get(row.id)?.total ?? 0),
    faskesCount: Number(orgs.get(row.id)?.faskes ?? 0),
    contentCount: Number(contents.get(row.id)?.total ?? 0),
    approvedCount: Number(contents.get(row.id)?.approved ?? 0),
    pendingCount: Number(contents.get(row.id)?.pending ?? 0),
  }));
}

export type RedNoticeRow = OrganizationSummary & {
  lifetimeSubmitted: number;
};

export async function listRedNotice(scope: Scope): Promise<RedNoticeRow[]> {
  const organizations = await listOrganizations(scope);
  return organizations
    .filter(
      (organization) =>
        organization.organizationType === "FASKES" &&
        organization.status === "ACTIVE" &&
        organization.submittedCount === 0,
    )
    .map((organization) => ({
      ...organization,
      lifetimeSubmitted: organization.submittedCount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export type RankingRow = {
  id: string;
  name: string;
  faskesClass: string | null;
  faskesCode: string | null;
  branchName: string | null;
  approvedCount: number;
  submittedCount: number;
  approvalRate: number | null;
};

export async function listFaskesRankings(
  scope: Scope,
  limit = 10,
): Promise<RankingRow[]> {
  const organizations = await listOrganizations(scope);
  const faskes = organizations.filter(
    (organization) =>
      organization.organizationType === "FASKES" &&
      organization.status === "ACTIVE",
  );

  return faskes
    .map((organization) => ({
      id: organization.id,
      name: organization.name,
      faskesClass: organization.faskesClass,
      faskesCode: organization.faskesCode,
      branchName: organization.branchName,
      approvedCount: organization.approvedCount,
      submittedCount: organization.submittedCount,
      approvalRate:
        organization.submittedCount > 0
          ? organization.approvedCount / organization.submittedCount
          : null,
    }))
    .sort(
      (a, b) =>
        b.approvedCount - a.approvedCount ||
        a.name.localeCompare(b.name, "id") ||
        (a.faskesCode ?? "").localeCompare(b.faskesCode ?? ""),
    )
    .slice(0, limit);
}

export async function countSubmittedSince(
  scope: Scope,
  since: Date,
): Promise<number> {
  const predicate = organizationScopePredicate(scope, {
    id: schema.stakeholders.id,
    branchId: schema.stakeholders.branchOfficeId,
  });
  const conditions = [
    eq(schema.contentSubmissions.archived, false),
    isNotNull(schema.contentSubmissions.submittedAt),
    sql`${schema.contentSubmissions.submittedAt} >= ${since}`,
  ];
  if (predicate) {
    const organizations = await getDb()
      .select({ id: schema.stakeholders.id })
      .from(schema.stakeholders)
      .where(predicate);
    conditions.push(
      inArray(
        schema.contentSubmissions.stakeholderId,
        organizations.map((row) => row.id),
      ),
    );
  }
  const [row] = await getDb()
    .select({ total: count() })
    .from(schema.contentSubmissions)
    .where(and(...conditions));
  return Number(row?.total ?? 0);
}
