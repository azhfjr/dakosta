import "server-only";

import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  ORG_SOURCES,
  ORG_SOURCE_LABELS,
  sourceOfOrganization,
  type OrgSource,
} from "@/lib/analytics/source";
import { monthRange } from "@/lib/kpi/formulas";
import { cachedRead, invalidateReadCache } from "@/lib/read-cache";
import { appendTargetHistory, type TargetHistoryEntry } from "@/lib/targets";

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
  branchOfficeId: string | null;
  regionalOfficeId: string | null;
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
      branchOfficeId: schema.stakeholders.branchOfficeId,
      regionalOfficeId: schema.branchOffices.regionalOfficeId,
    })
    .from(schema.stakeholders)
    .leftJoin(
      schema.branchOffices,
      eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
    )
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
  return cachedRead(
    JSON.stringify(["target-sync-preview", month]),
    () => loadTargetSyncPreview(month, db),
    { ttlMs: 60_000, maxStaleMs: 60_000 },
  );
}

async function loadTargetSyncPreview(
  month: string,
  db: TargetDb,
): Promise<TargetSyncPreview> {
  const range = monthRange(month);
  const sourceExpression = sql<OrgSource>`
    case
      when ${schema.stakeholders.organizationType} = 'FASKES'
        and ${schema.stakeholders.faskesClass} = 'FKRTL' then 'FASKES_FKRTL'
      when ${schema.stakeholders.organizationType} = 'FASKES' then 'FASKES_FKTP'
      when ${schema.stakeholders.organizationType} = 'PEMDA' then 'PEMDA'
      else 'OTHER'
    end
  `;

  const rows = await db
    .select({
      source: sourceExpression,
      activeOrganizations: count(schema.stakeholders.id),
      withTarget: count(schema.kpiTargets.id),
      smallestTarget: sql<number | null>`min(${schema.kpiTargets.targetCount})`,
      largestTarget: sql<number | null>`max(${schema.kpiTargets.targetCount})`,
    })
    .from(schema.stakeholders)
    .leftJoin(
      schema.kpiTargets,
      and(
        eq(schema.kpiTargets.stakeholderId, schema.stakeholders.id),
        eq(schema.kpiTargets.periodStart, range.startLocal),
        eq(schema.kpiTargets.periodEnd, range.endLocal),
        isNull(schema.kpiTargets.regionalOfficeId),
        isNull(schema.kpiTargets.branchOfficeId),
        isNull(schema.kpiTargets.themeId),
        isNull(schema.kpiTargets.subTheme),
      ),
    )
    .where(eq(schema.stakeholders.status, "ACTIVE"))
    .groupBy(sourceExpression);

  const bySource = new Map(rows.map((row) => [row.source, row]));
  const sources: TargetSyncSourcePreview[] = ORG_SOURCES.flatMap((source) => {
    const row = bySource.get(source);
    if (!row) return [];
    const activeOrganizations = Number(row.activeOrganizations);
    if (activeOrganizations === 0) return [];
    const withTarget = Number(row.withTarget);
    const smallest =
      row.smallestTarget === null ? null : Number(row.smallestTarget);
    const largest =
      row.largestTarget === null ? null : Number(row.largestTarget);
    const uniform = withTarget === 0 || smallest === largest;
    return [
      {
        source,
        label: ORG_SOURCE_LABELS[source],
        activeOrganizations,
        withTarget,
        missing: activeOrganizations - withTarget,
        currentTarget: uniform ? smallest : null,
        uniform,
      },
    ];
  });

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
  const history: TargetHistoryEntry[] = [];

  for (const entry of input.entries) {
    const organizations = grouped.get(entry.source) ?? [];
    if (organizations.length === 0) continue;
    const ids = organizations.map((organization) => organization.id);
    const reportingUnit = entry.reportingUnit?.trim() || "konten";
    const byId = new Map(
      organizations.map((organization) => [organization.id, organization]),
    );
    const pushHistory = (
      row: { id: string; stakeholderId: string | null; targetCount: number },
      changeType: "CREATED" | "UPDATED",
    ) => {
      if (!row.stakeholderId) return;
      const organization = byId.get(row.stakeholderId);
      if (!organization) return;
      history.push({
        targetId: row.id,
        stakeholderId: row.stakeholderId,
        branchOfficeId: organization.branchOfficeId,
        regionalOfficeId: organization.regionalOfficeId,
        themeId: null,
        subTheme: null,
        periodStart: range.startLocal,
        periodEnd: range.endLocal,
        targetCount: Number(row.targetCount),
        changeType,
        actorId: input.actorId,
      });
    };

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
        id: schema.kpiTargets.id,
        stakeholderId: schema.kpiTargets.stakeholderId,
        targetCount: schema.kpiTargets.targetCount,
      });
    updatedRows.forEach((row) => pushHistory(row, "UPDATED"));

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
          .returning({
            id: schema.kpiTargets.id,
            stakeholderId: schema.kpiTargets.stakeholderId,
            targetCount: schema.kpiTargets.targetCount,
          });
        created = inserted.length;
        inserted.forEach((row) => pushHistory(row, "CREATED"));
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
          .returning({
            id: schema.kpiTargets.id,
            stakeholderId: schema.kpiTargets.stakeholderId,
            targetCount: schema.kpiTargets.targetCount,
          });
        retried.forEach((row) => pushHistory(row, "UPDATED"));
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

  if (history.length > 0) {
    await appendTargetHistory(db, history);
  }

  invalidateReadCache();
  return result;
}
