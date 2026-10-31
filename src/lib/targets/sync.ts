import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  ORG_SOURCES,
  ORG_SOURCE_LABELS,
  sourceOfOrganization,
  type OrgSource,
} from "@/lib/analytics/source";
import { monthRange } from "@/lib/kpi/formulas";

export type TargetSyncEntry = {
  source: OrgSource;
  targetCount: number;
  reportingUnit?: string;
};

export type TargetSyncSourcePreview = {
  source: OrgSource;
  label: string;
  activeOrganizations: number;
  withTarget: number;
  missing: number;
  currentTarget: number | null;
  uniform: boolean;
};

export type TargetSyncPreview = {
  month: string;
  sources: TargetSyncSourcePreview[];
  totalActiveOrganizations: number;
};

export type TargetSyncResult = {
  month: string;
  created: number;
  updated: number;
  perSource: Array<{
    source: OrgSource;
    label: string;
    targetCount: number;
    organizations: number;
    created: number;
    updated: number;
  }>;
};

type OrganizationKey = {
  id: string;
  organizationType: string;
  faskesClass: string | null;
};

export type TargetDb = ReturnType<typeof getDb>;

async function activeOrganizationsBySource(
  db: TargetDb,
): Promise<Map<OrgSource, OrganizationKey[]>> {
  const rows = await db
    .select({
      id: schema.stakeholders.id,
      organizationType: schema.stakeholders.organizationType,
      faskesClass: schema.stakeholders.faskesClass,
    })
    .from(schema.stakeholders)
    .where(eq(schema.stakeholders.status, "ACTIVE"));

  const grouped = new Map<OrgSource, OrganizationKey[]>();
  for (const row of rows) {
    const source = sourceOfOrganization(row);
    const bucket = grouped.get(source) ?? [];
    bucket.push(row);
    grouped.set(source, bucket);
  }
  return grouped;
}

function orgScopePredicate(stakeholderIds: string[]) {
  return and(
    inArray(schema.kpiTargets.stakeholderId, stakeholderIds),
    isNull(schema.kpiTargets.regionalOfficeId),
    isNull(schema.kpiTargets.branchOfficeId),
    isNull(schema.kpiTargets.themeId),
    isNull(schema.kpiTargets.subTheme),
  );
}

export async function getTargetSyncPreview(
  month: string,
  db: TargetDb = getDb(),
): Promise<TargetSyncPreview> {
  const range = monthRange(month);
  const grouped = await activeOrganizationsBySource(db);
  const allIds = ORG_SOURCES.flatMap((source) =>
    (grouped.get(source) ?? []).map((org) => org.id),
  );

  const existing =
    allIds.length === 0
      ? []
      : await db
          .select({
            stakeholderId: schema.kpiTargets.stakeholderId,
            targetCount: schema.kpiTargets.targetCount,
          })
          .from(schema.kpiTargets)
          .where(
            and(
              eq(schema.kpiTargets.periodStart, range.startLocal),
              eq(schema.kpiTargets.periodEnd, range.endLocal),
              orgScopePredicate(allIds),
            ),
          );

  const byStakeholder = new Map<string, number>();
  for (const row of existing) {
    if (row.stakeholderId) {
      byStakeholder.set(row.stakeholderId, Number(row.targetCount));
    }
  }

  const sources: TargetSyncSourcePreview[] = ORG_SOURCES.map((source) => {
    const organizations = grouped.get(source) ?? [];
    let withTarget = 0;
    let uniform = true;
    let currentTarget: number | null = null;
    for (const organization of organizations) {
      const value = byStakeholder.get(organization.id);
      if (value === undefined) continue;
      withTarget += 1;
      if (currentTarget === null) currentTarget = value;
      else if (currentTarget !== value) uniform = false;
    }
    return {
      source,
      label: ORG_SOURCE_LABELS[source],
      activeOrganizations: organizations.length,
      withTarget,
      missing: organizations.length - withTarget,
      currentTarget: uniform ? currentTarget : null,
      uniform,
    };
  }).filter((item) => item.activeOrganizations > 0);

  return {
    month: range.key,
    sources,
    totalActiveOrganizations: sources.reduce(
      (sum, item) => sum + item.activeOrganizations,
      0,
    ),
  };
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}

/**
 * Applies one target per input source to every ACTIVE organization in that
 * source for the given month. Existing organization-level targets are updated
 * in place; missing rows are inserted. Sub-theme targets and manually scoped
 * regional/branch targets are never touched.
 */
export async function syncTargets(input: {
  month: string;
  entries: TargetSyncEntry[];
  actorId: string;
  db?: TargetDb;
}): Promise<TargetSyncResult> {
  const range = monthRange(input.month);
  const db = input.db ?? getDb();
  const grouped = await activeOrganizationsBySource(db);

  const result: TargetSyncResult = {
    month: range.key,
    created: 0,
    updated: 0,
    perSource: [],
  };

  for (const entry of input.entries) {
    const organizations = grouped.get(entry.source) ?? [];
    if (organizations.length === 0) continue;
    const ids = organizations.map((organization) => organization.id);
    const reportingUnit = entry.reportingUnit?.trim() || "konten";

    const updatedRows = await db
      .update(schema.kpiTargets)
      .set({
        targetCount: entry.targetCount,
        reportingUnit,
        updatedBy: input.actorId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.kpiTargets.periodStart, range.startLocal),
          eq(schema.kpiTargets.periodEnd, range.endLocal),
          orgScopePredicate(ids),
        ),
      )
      .returning({
        stakeholderId: schema.kpiTargets.stakeholderId,
        targetCount: schema.kpiTargets.targetCount,
      });

    const matched = new Set(
      updatedRows
        .map((row) => row.stakeholderId)
        .filter((id): id is string => Boolean(id)),
    );
    const missing = ids.filter((id) => !matched.has(id));

    let created = 0;
    if (missing.length > 0) {
      try {
        const inserted = await db
          .insert(schema.kpiTargets)
          .values(
            missing.map((stakeholderId) => ({
              workspaceLabel: "Workspace",
              stakeholderId,
              themeId: null,
              subTheme: null,
              periodStart: range.startLocal,
              periodEnd: range.endLocal,
              targetCount: entry.targetCount,
              reportingUnit,
              createdBy: input.actorId,
              updatedBy: input.actorId,
            })),
          )
          .returning({ id: schema.kpiTargets.id });
        created = inserted.length;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // A concurrent sync inserted the row first; update instead of failing.
        const retried = await db
          .update(schema.kpiTargets)
          .set({
            targetCount: entry.targetCount,
            reportingUnit,
            updatedBy: input.actorId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.kpiTargets.periodStart, range.startLocal),
              eq(schema.kpiTargets.periodEnd, range.endLocal),
              orgScopePredicate(missing),
            ),
          )
          .returning({ id: schema.kpiTargets.id });
        created = 0;
        result.updated += retried.length;
      }
    }

    result.created += created;
    result.updated += updatedRows.length;
    result.perSource.push({
      source: entry.source,
      label: ORG_SOURCE_LABELS[entry.source],
      targetCount: entry.targetCount,
      organizations: organizations.length,
      created,
      updated: updatedRows.length,
    });
  }

  return result;
}
