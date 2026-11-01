import "server-only";

import { and, count, eq, sql, type SQL } from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  listOrganizations,
  listRedNotice,
  type OrganizationSummary,
} from "@/lib/hierarchy";
import { monthKeyFor, monthRange } from "@/lib/kpi/formulas";
import type { SessionUser } from "@/lib/session";

export type RedNoticeEntry = OrganizationSummary & {
  reason: "NEVER_SUBMITTED" | "INACTIVE_IN_PERIOD";
  lifetimeSubmitted: number;
};

/**
 * Red Notice = active FASKES with zero lifetime submitted content. Period
 * inactivity is a separate, clearly labelled list so the two are never mixed.
 */
export async function getRedNotice(user: SessionUser): Promise<{
  neverSubmitted: RedNoticeEntry[];
  inactiveInPeriod: RedNoticeEntry[];
  month: string;
  totalFaskes: number;
}> {
  const month = monthKeyFor();
  const range = monthRange(month);
  const [organizations, never] = await Promise.all([
    listOrganizations(user.scope),
    listRedNotice(user.scope),
  ]);

  const activeFaskes = organizations.filter(
    (organization) =>
      organization.organizationType === "FASKES" &&
      organization.status === "ACTIVE",
  );

  const scopeCondition: SQL[] = [
    eq(schema.stakeholders.organizationType, "FASKES"),
    eq(schema.stakeholders.status, "ACTIVE"),
    sql`exists (
      select 1 from ${schema.contentSubmissions}
      where ${schema.contentSubmissions.stakeholderId} = ${schema.stakeholders.id}
        and ${schema.contentSubmissions.submittedAt} is not null
    )`,
    sql`not exists (
      select 1 from ${schema.contentSubmissions}
      where ${schema.contentSubmissions.stakeholderId} = ${schema.stakeholders.id}
        and ${schema.contentSubmissions.submittedAt} is not null
        and ${schema.contentSubmissions.submittedAt} >= ${range.startInstant}
        and ${schema.contentSubmissions.submittedAt} <= ${range.endInstant}
    )`,
  ];

  if (user.scope.kind === "BRANCH") {
    scopeCondition.push(
      eq(schema.stakeholders.branchOfficeId, user.scope.branchId),
    );
  } else if (user.scope.kind === "REGION") {
    scopeCondition.push(
      user.scope.branchIds.length === 0
        ? sql`false`
        : sql`${schema.stakeholders.branchOfficeId} in (${sql.join(
            user.scope.branchIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
    );
  } else if (user.scope.kind === "ORG") {
    scopeCondition.push(eq(schema.stakeholders.id, user.scope.organizationId));
  }

  const inactiveRows = await getDb()
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
      regionId: schema.branchOffices.regionalOfficeId,
      regionName: schema.regionalOffices.name,
      latitude: schema.stakeholders.latitude,
      longitude: schema.stakeholders.longitude,
      joinedAt: schema.stakeholders.joinedAt,
      submitted: count(schema.contentSubmissions.id),
    })
    .from(schema.stakeholders)
    .innerJoin(
      schema.contentSubmissions,
      eq(schema.contentSubmissions.stakeholderId, schema.stakeholders.id),
    )
    .leftJoin(
      schema.branchOffices,
      eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
    )
    .leftJoin(
      schema.regionalOffices,
      eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
    )
    .where(and(...scopeCondition))
    .groupBy(
      schema.stakeholders.id,
      schema.branchOffices.name,
      schema.branchOffices.regionalOfficeId,
      schema.regionalOffices.name,
    )
    .orderBy(schema.stakeholders.name);

  const neverEntries: RedNoticeEntry[] = never.map((organization) => ({
    ...organization,
    reason: "NEVER_SUBMITTED",
    lifetimeSubmitted: organization.submittedCount,
  }));

  const inactiveEntries: RedNoticeEntry[] = inactiveRows.map((row) => ({
    id: row.id,
    name: row.name,
    organizationType: row.organizationType,
    faskesClass: row.faskesClass,
    faskesCode: row.faskesCode,
    category: row.category,
    serviceArea: row.serviceArea,
    addressLabel: row.addressLabel ?? null,
    status: row.status,
    branchId: row.branchId,
    branchName: row.branchName,
    regionId: row.regionId,
    regionName: row.regionName,
    latitude: row.latitude,
    longitude: row.longitude,
    joinedAt: row.joinedAt,
    contentCount: Number(row.submitted),
    submittedCount: Number(row.submitted),
    approvedCount: 0,
    pendingCount: 0,
    lastSubmittedAt: null,
    accountCount: 0,
    reason: "INACTIVE_IN_PERIOD",
    lifetimeSubmitted: Number(row.submitted),
  }));

  return {
    neverSubmitted: neverEntries,
    inactiveInPeriod: inactiveEntries,
    month,
    totalFaskes: activeFaskes.length,
  };
}

export type { OrganizationSummary };
