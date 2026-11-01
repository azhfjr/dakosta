import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb, schema } from "@/db";

export type ReconcileRow = {
  branchId: string;
  branchName: string;
  approved: number;
  pending: number;
  organizations: number;
};

export type ReconcileResult = {
  branches: ReconcileRow[];
  regionApproved: number;
  sumBranchApproved: number;
  regionPending: number;
  sumBranchPending: number;
  reconciled: boolean;
};

/**
 * Additive metrics must reconcile region = sum(branches). Distinct organization
 * counts are intentionally excluded because summing them would double count.
 */
export async function reconcileRegion(
  regionId: string,
): Promise<ReconcileResult> {
  const db = getDb();
  const branchRows = await db
    .select({ id: schema.branchOffices.id, name: schema.branchOffices.name })
    .from(schema.branchOffices)
    .where(eq(schema.branchOffices.regionalOfficeId, regionId))
    .orderBy(schema.branchOffices.name);

  const branchIds = branchRows.map((row) => row.id);
  const branches: ReconcileRow[] = [];

  if (branchIds.length > 0) {
    const aggregates = await db
      .select({
        branchId: schema.stakeholders.branchOfficeId,
        approved: sql<number>`count(*) filter (where ${schema.contentSubmissions.status} = 'APPROVED')`,
        pending: sql<number>`count(*) filter (where ${schema.contentSubmissions.status} in ('SUBMITTED','IN_REVIEW','RESUBMITTED'))`,
        organizations: sql<number>`count(distinct ${schema.contentSubmissions.stakeholderId})`,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(
        and(
          inArray(schema.stakeholders.branchOfficeId, branchIds),
          eq(schema.contentSubmissions.archived, false),
        ),
      )
      .groupBy(schema.stakeholders.branchOfficeId);

    const map = new Map(aggregates.map((row) => [row.branchId, row]));
    for (const branch of branchRows) {
      const row = map.get(branch.id);
      branches.push({
        branchId: branch.id,
        branchName: branch.name,
        approved: Number(row?.approved ?? 0),
        pending: Number(row?.pending ?? 0),
        organizations: Number(row?.organizations ?? 0),
      });
    }
  }

  const [regionAggregate] = await db
    .select({
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
        eq(schema.branchOffices.regionalOfficeId, regionId),
        eq(schema.contentSubmissions.archived, false),
      ),
    );

  const sumBranchApproved = branches.reduce(
    (sum, row) => sum + row.approved,
    0,
  );
  const sumBranchPending = branches.reduce((sum, row) => sum + row.pending, 0);
  const regionApproved = Number(regionAggregate?.approved ?? 0);

  return {
    branches,
    regionApproved,
    sumBranchApproved,
    regionPending: Number(regionAggregate?.pending ?? 0),
    sumBranchPending,
    reconciled:
      regionApproved === sumBranchApproved &&
      Number(regionAggregate?.pending ?? 0) === sumBranchPending,
  };
}
