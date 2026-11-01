import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { errors } from "@/lib/errors";
import { achievementPercent, monthRange } from "@/lib/kpi/formulas";
import { cachedRead, invalidateReadCache } from "@/lib/read-cache";
import {
  LEGACY_THEME_TO_SUBTHEME,
  isSubTheme,
  SUB_THEME_LABELS,
  type SubTheme,
} from "@/lib/taxonomy";

export type TargetScopeSource =
  | "GLOBAL"
  | "STAKEHOLDER"
  | "SUB_THEME"
  | "STAKEHOLDER_SUB_THEME"
  | "AGGREGATE";

export type TargetScopeRow = {
  id: string;
  stakeholderId: string | null;
  stakeholderName: string | null;
  themeId: string | null;
  themeName: string | null;
  subTheme: SubTheme | null;
  subThemeLabel: string | null;
  targetCount: number;
  approved: number;
  achievement: number | null;
  periodStart: string;
  periodEnd: string;
  updatedAt: Date;
};

export type TargetOverviewPagination = {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
};

export type TargetOverview = {
  month: string;
  periodLabel: string;
  rows: TargetScopeRow[];
  totals: {
    target: number;
    approved: number;
    achievement: number | null;
    scopes: number;
    hasGlobal: boolean;
  };
  pagination: TargetOverviewPagination;
};

export type TargetOverviewOptions = {
  /** 1-based page for paginated rows. Ignored when `stakeholderId` is set. */
  page?: number;
  /** Number of rows per page; 0 returns totals only. */
  pageSize?: number;
  /** Returns the stakeholder's rows plus every global row for target fallback. */
  stakeholderId?: string;
};

const DEFAULT_TARGET_PAGE_SIZE = 50;
const MAX_TARGET_PAGE_SIZE = 200;

type TargetKeyRow = {
  stakeholderId: string | null;
  themeId: string | null;
  subTheme: string | null;
  themeSlug?: string | null;
  targetCount: number;
};

function targetSubTheme(row: {
  subTheme: string | null;
  themeSlug: string | null;
}): SubTheme | null {
  if (isSubTheme(row.subTheme)) return row.subTheme;
  if (row.themeSlug && LEGACY_THEME_TO_SUBTHEME[row.themeSlug]) {
    return LEGACY_THEME_TO_SUBTHEME[row.themeSlug]!;
  }
  return null;
}

export function resolveTargetAmount(
  rows: TargetKeyRow[],
  scope: { stakeholderId: string | null; subTheme: string | null },
): { target: number | null; source: TargetScopeSource | null } {
  const match = (stakeholderId: string | null, subTheme: string | null) =>
    rows.find(
      (row) =>
        row.stakeholderId === stakeholderId &&
        targetSubTheme({
          subTheme: row.subTheme,
          themeSlug: row.themeSlug ?? null,
        }) === subTheme,
    );

  if (scope.stakeholderId && scope.subTheme) {
    const row = match(scope.stakeholderId, scope.subTheme);
    return {
      target: row?.targetCount ?? null,
      source: row ? "STAKEHOLDER_SUB_THEME" : null,
    };
  }
  if (scope.stakeholderId) {
    const row = match(scope.stakeholderId, null);
    return {
      target: row?.targetCount ?? null,
      source: row ? "STAKEHOLDER" : null,
    };
  }
  if (scope.subTheme) {
    const row = match(null, scope.subTheme);
    return {
      target: row?.targetCount ?? null,
      source: row ? "SUB_THEME" : null,
    };
  }
  const row = match(null, null);
  return { target: row?.targetCount ?? null, source: row ? "GLOBAL" : null };
}

export function resolveAggregateTarget(
  rows: TargetKeyRow[],
  stakeholderIds: string[],
  subTheme: string | null,
): { target: number | null; source: TargetScopeSource | null } {
  if (stakeholderIds.length === 0) return { target: null, source: null };
  const resolved = stakeholderIds.map((stakeholderId) =>
    resolveTargetAmount(rows, { stakeholderId, subTheme }),
  );
  if (resolved.some((item) => item.target === null)) {
    return { target: null, source: null };
  }
  const target = resolved.reduce((sum, item) => sum + (item.target ?? 0), 0);
  const source: TargetScopeSource =
    resolved.length > 1
      ? "AGGREGATE"
      : (resolved[0]?.source ??
        (subTheme ? "STAKEHOLDER_SUB_THEME" : "STAKEHOLDER"));
  return { target, source };
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}

export type TargetHistoryChange = "CREATED" | "UPDATED" | "DELETED";

export type TargetHistoryEntry = {
  targetId: string;
  stakeholderId: string | null;
  branchOfficeId: string | null;
  regionalOfficeId: string | null;
  themeId: string | null;
  subTheme: string | null;
  periodStart: string;
  periodEnd: string;
  targetCount: number;
  changeType: TargetHistoryChange;
  actorId: string | null;
};

type TargetDbLike = Pick<ReturnType<typeof getDb>, "insert" | "select">;

export async function appendTargetHistory(
  db: TargetDbLike,
  entries: TargetHistoryEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const chunkSize = 500;
  for (let index = 0; index < entries.length; index += chunkSize) {
    await db
      .insert(schema.kpiTargetHistory)
      .values(entries.slice(index, index + chunkSize));
  }
}

async function targetOfficeScope(
  db: TargetDbLike,
  stakeholderId: string | null,
): Promise<{ branchOfficeId: string | null; regionalOfficeId: string | null }> {
  if (!stakeholderId) {
    return { branchOfficeId: null, regionalOfficeId: null };
  }
  const [row] = await db
    .select({
      branchOfficeId: schema.stakeholders.branchOfficeId,
      regionalOfficeId: schema.branchOffices.regionalOfficeId,
    })
    .from(schema.stakeholders)
    .leftJoin(
      schema.branchOffices,
      eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
    )
    .where(eq(schema.stakeholders.id, stakeholderId))
    .limit(1);
  return {
    branchOfficeId: row?.branchOfficeId ?? null,
    regionalOfficeId: row?.regionalOfficeId ?? null,
  };
}

function clampTargetPageSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TARGET_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(value), 1), MAX_TARGET_PAGE_SIZE);
}

export async function getTargetOverview(
  month: string,
  options: TargetOverviewOptions = {},
): Promise<TargetOverview> {
  const stakeholderId = options.stakeholderId ?? null;
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize =
    stakeholderId !== null
      ? 0
      : options.pageSize === 0
        ? 0
        : clampTargetPageSize(options.pageSize ?? DEFAULT_TARGET_PAGE_SIZE);
  return cachedRead(
    JSON.stringify(["target-overview", month, stakeholderId, page, pageSize]),
    () => loadTargetOverview(month, { stakeholderId, page, pageSize }),
    { ttlMs: 60_000, maxStaleMs: 60_000 },
  );
}

type TargetSummaryRecord = {
  scopes: string | number;
  target_sum: string | number | null;
  global_target: string | number | null;
  approved_total: string | number;
  approved_by_subtheme: Record<string, string | number> | null;
  approved_by_theme: Record<string, string | number> | null;
};

type TargetPageRecord = {
  id: string;
  stakeholder_id: string | null;
  stakeholder_name: string | null;
  theme_id: string | null;
  theme_name: string | null;
  theme_slug: string | null;
  sub_theme: string | null;
  target_count: string | number;
  period_start: string;
  period_end: string;
  updated_at: Date;
  org_approved: string | number | null;
};

function numericMap(
  record: Record<string, string | number> | null,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!record) return map;
  for (const [key, value] of Object.entries(record)) {
    map.set(key, Number(value));
  }
  return map;
}

async function loadTargetOverview(
  month: string,
  options: { stakeholderId: string | null; page: number; pageSize: number },
): Promise<TargetOverview> {
  const db = getDb();
  const range = monthRange(month);

  const summaryResult = await db.execute(sql`
    select
      (select count(*) from "kpi_targets"
        where "period_start" = ${range.startLocal}
          and "period_end" = ${range.endLocal}) as scopes,
      (select coalesce(sum("target_count"), 0) from "kpi_targets"
        where "period_start" = ${range.startLocal}
          and "period_end" = ${range.endLocal}) as target_sum,
      (select "target_count" from "kpi_targets"
        where "period_start" = ${range.startLocal}
          and "period_end" = ${range.endLocal}
          and "stakeholder_id" is null
          and "sub_theme" is null
        order by "id"
        limit 1) as global_target,
      (select count(*) from "content_submissions"
        where "status" = 'APPROVED'
          and "approved_at" >= ${range.startInstant}
          and "approved_at" < ${range.endInstant}) as approved_total,
      (select coalesce(jsonb_object_agg("sub_theme", "total"), '{}'::jsonb)
        from (
          select "sub_theme", count(*) as total
            from "content_submissions"
           where "status" = 'APPROVED'
             and "approved_at" >= ${range.startInstant}
             and "approved_at" < ${range.endInstant}
             and "sub_theme" is not null
           group by "sub_theme"
        ) grouped) as approved_by_subtheme,
      (select coalesce(jsonb_object_agg("theme_id", "total"), '{}'::jsonb)
        from (
          select "theme_id", count(*) as total
            from "content_submissions"
           where "status" = 'APPROVED'
             and "approved_at" >= ${range.startInstant}
             and "approved_at" < ${range.endInstant}
             and "sub_theme" is null
             and "theme_id" is not null
           group by "theme_id"
        ) grouped) as approved_by_theme
  `);
  const summary = (summaryResult.rows as unknown as TargetSummaryRecord[])[0];

  const scopes = Number(summary?.scopes ?? 0);
  const targetSum = Number(summary?.target_sum ?? 0);
  const globalTarget =
    summary?.global_target === null || summary?.global_target === undefined
      ? null
      : Number(summary.global_target);
  const approvedTotal = Number(summary?.approved_total ?? 0);
  const bySubTheme = numericMap(summary?.approved_by_subtheme ?? null);
  const byLegacyTheme = numericMap(summary?.approved_by_theme ?? null);

  let rows: TargetScopeRow[] = [];
  let page = 1;
  let pageSize = 0;
  let pageCount = 0;

  if (options.stakeholderId !== null || options.pageSize > 0) {
    pageSize = options.stakeholderId !== null ? 0 : options.pageSize;
    pageCount = pageSize > 0 ? Math.max(1, Math.ceil(scopes / pageSize)) : 0;
    page = pageSize > 0 ? Math.min(options.page, pageCount) : 1;
    const paginated = pageSize > 0;
    const pageResult = await db.execute(sql`
      select
        t."id",
        t."stakeholder_id",
        s."name" as stakeholder_name,
        t."theme_id",
        th."name" as theme_name,
        th."slug" as theme_slug,
        t."sub_theme",
        t."target_count",
        t."period_start",
        t."period_end",
        t."updated_at",
        case
          when t."stakeholder_id" is not null and t."sub_theme" is not null then (
            select count(*) from "content_submissions" c
             where c."status" = 'APPROVED'
               and c."approved_at" >= ${range.startInstant}
               and c."approved_at" < ${range.endInstant}
               and c."stakeholder_id" = t."stakeholder_id"
               and c."sub_theme" = t."sub_theme"
          )
          when t."stakeholder_id" is not null then (
            select count(*) from "content_submissions" c
             where c."status" = 'APPROVED'
               and c."approved_at" >= ${range.startInstant}
               and c."approved_at" < ${range.endInstant}
               and c."stakeholder_id" = t."stakeholder_id"
          )
          else null
        end as org_approved
      from "kpi_targets" t
      left join "stakeholders" s on s."id" = t."stakeholder_id"
      left join "themes" th on th."id" = t."theme_id"
      where t."period_start" = ${range.startLocal}
        and t."period_end" = ${range.endLocal}
        ${
          options.stakeholderId !== null
            ? sql`and (t."stakeholder_id" = ${options.stakeholderId} or t."stakeholder_id" is null)`
            : sql``
        }
      order by t."stakeholder_id" asc nulls last,
        t."sub_theme" asc nulls last,
        t."id" asc
      ${paginated ? sql`limit ${pageSize} offset ${(page - 1) * pageSize}` : sql``}
    `);
    const pageRows = pageResult.rows as unknown as TargetPageRecord[];
    rows = pageRows.map((row) => {
      const subTheme = targetSubTheme({
        subTheme: row.sub_theme,
        themeSlug: row.theme_slug,
      });
      let approved: number;
      if (row.stakeholder_id) {
        approved = Number(row.org_approved ?? 0);
      } else if (subTheme) {
        approved = bySubTheme.get(subTheme) ?? 0;
      } else if (row.theme_id) {
        approved = byLegacyTheme.get(row.theme_id) ?? 0;
      } else {
        approved = approvedTotal;
      }
      return {
        id: row.id,
        stakeholderId: row.stakeholder_id,
        stakeholderName: row.stakeholder_name,
        themeId: row.theme_id,
        themeName: row.theme_name,
        subTheme,
        subThemeLabel: subTheme ? SUB_THEME_LABELS[subTheme] : null,
        targetCount: Number(row.target_count),
        approved,
        achievement: achievementPercent(approved, Number(row.target_count)),
        periodStart: row.period_start,
        periodEnd: row.period_end,
        updatedAt: row.updated_at,
      };
    });
    if (options.stakeholderId !== null) pageSize = rows.length;
  }

  const target = globalTarget ?? null;

  return {
    month: range.key,
    periodLabel: range.label,
    rows,
    totals: {
      target: target ?? targetSum,
      approved: approvedTotal,
      achievement: achievementPercent(approvedTotal, target),
      scopes,
      hasGlobal: target !== null,
    },
    pagination: {
      page,
      pageSize,
      pageCount,
      total: scopes,
    },
  };
}

export type TargetStakeholderOption = { id: string; name: string };

export async function listTargetStakeholders(): Promise<
  TargetStakeholderOption[]
> {
  return getDb()
    .select({ id: schema.stakeholders.id, name: schema.stakeholders.name })
    .from(schema.stakeholders)
    .where(eq(schema.stakeholders.status, "ACTIVE"))
    .orderBy(asc(schema.stakeholders.name));
}

export type TargetRecord = {
  id: string;
  stakeholderId: string | null;
  subTheme: SubTheme | null;
  targetCount: number;
  reportingUnit: string;
  periodStart: string;
  periodEnd: string;
};

export async function findTarget(id: string): Promise<TargetRecord | null> {
  const [row] = await getDb()
    .select({
      id: schema.kpiTargets.id,
      stakeholderId: schema.kpiTargets.stakeholderId,
      subTheme: schema.kpiTargets.subTheme,
      targetCount: schema.kpiTargets.targetCount,
      reportingUnit: schema.kpiTargets.reportingUnit,
      periodStart: schema.kpiTargets.periodStart,
      periodEnd: schema.kpiTargets.periodEnd,
    })
    .from(schema.kpiTargets)
    .where(eq(schema.kpiTargets.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    subTheme: isSubTheme(row.subTheme) ? row.subTheme : null,
    targetCount: Number(row.targetCount),
  };
}

export type TargetMutationInput = {
  month: string;
  stakeholderId: string | null;
  subTheme: SubTheme | null;
  targetCount: number;
  reportingUnit: string;
};

export async function createTarget(
  input: TargetMutationInput,
  actorId: string,
): Promise<{ id: string }> {
  const db = getDb();
  const range = monthRange(input.month);
  if (input.stakeholderId) {
    const [stakeholder] = await db
      .select({ id: schema.stakeholders.id })
      .from(schema.stakeholders)
      .where(eq(schema.stakeholders.id, input.stakeholderId))
      .limit(1);
    if (!stakeholder) throw errors.validation("Stakeholder tidak ditemukan.");
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.kpiTargets)
        .values({
          workspaceLabel: "Workspace",
          stakeholderId: input.stakeholderId,
          themeId: null,
          subTheme: input.subTheme,
          periodStart: range.startLocal,
          periodEnd: range.endLocal,
          targetCount: input.targetCount,
          reportingUnit: input.reportingUnit,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning({ id: schema.kpiTargets.id });
      if (!row) throw errors.server("Target tidak dapat disimpan.");
      const scope = await targetOfficeScope(tx, input.stakeholderId);
      await appendTargetHistory(tx, [
        {
          targetId: row.id,
          stakeholderId: input.stakeholderId,
          branchOfficeId: scope.branchOfficeId,
          regionalOfficeId: scope.regionalOfficeId,
          themeId: null,
          subTheme: input.subTheme,
          periodStart: range.startLocal,
          periodEnd: range.endLocal,
          targetCount: input.targetCount,
          changeType: "CREATED",
          actorId,
        },
      ]);
      return { id: row.id };
    });
    invalidateReadCache();
    return result;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw errors.conflict(
        "Target untuk cakupan dan periode ini sudah ada. Ubah target yang sudah ada.",
      );
    }
    throw error;
  }
}

export async function updateTarget(
  id: string,
  input: {
    stakeholderId?: string | null;
    subTheme?: SubTheme | null;
    targetCount?: number;
    reportingUnit?: string;
  },
  actorId: string,
): Promise<void> {
  const db = getDb();
  if (input.stakeholderId) {
    const [stakeholder] = await db
      .select({ id: schema.stakeholders.id })
      .from(schema.stakeholders)
      .where(eq(schema.stakeholders.id, input.stakeholderId))
      .limit(1);
    if (!stakeholder) throw errors.validation("Stakeholder tidak ditemukan.");
  }
  const [existing] = await db
    .select({
      id: schema.kpiTargets.id,
      stakeholderId: schema.kpiTargets.stakeholderId,
      themeId: schema.kpiTargets.themeId,
      subTheme: schema.kpiTargets.subTheme,
      targetCount: schema.kpiTargets.targetCount,
      reportingUnit: schema.kpiTargets.reportingUnit,
      periodStart: schema.kpiTargets.periodStart,
      periodEnd: schema.kpiTargets.periodEnd,
    })
    .from(schema.kpiTargets)
    .where(eq(schema.kpiTargets.id, id))
    .limit(1);
  if (!existing) throw errors.notFound("Target tidak ditemukan.");

  const stakeholderId =
    input.stakeholderId !== undefined
      ? input.stakeholderId
      : existing.stakeholderId;
  const subTheme =
    input.subTheme !== undefined ? input.subTheme : existing.subTheme;
  const targetCount =
    input.targetCount !== undefined
      ? input.targetCount
      : Number(existing.targetCount);
  const reportingUnit = input.reportingUnit ?? existing.reportingUnit;

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(schema.kpiTargets)
        .set({
          stakeholderId,
          subTheme,
          targetCount,
          reportingUnit,
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(schema.kpiTargets.id, id))
        .returning({ id: schema.kpiTargets.id });
      if (!row) throw errors.notFound("Target tidak ditemukan.");
      const scope = await targetOfficeScope(tx, stakeholderId);
      await appendTargetHistory(tx, [
        {
          targetId: id,
          stakeholderId,
          branchOfficeId: scope.branchOfficeId,
          regionalOfficeId: scope.regionalOfficeId,
          themeId: existing.themeId,
          subTheme: isSubTheme(subTheme) ? subTheme : null,
          periodStart: existing.periodStart,
          periodEnd: existing.periodEnd,
          targetCount,
          changeType: "UPDATED",
          actorId,
        },
      ]);
    });
    invalidateReadCache();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw errors.conflict(
        "Target untuk cakupan dan periode ini sudah ada. Ubah target yang sudah ada.",
      );
    }
    throw error;
  }
}

export async function deleteTarget(id: string, actorId: string): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({
      id: schema.kpiTargets.id,
      stakeholderId: schema.kpiTargets.stakeholderId,
      themeId: schema.kpiTargets.themeId,
      subTheme: schema.kpiTargets.subTheme,
      targetCount: schema.kpiTargets.targetCount,
      periodStart: schema.kpiTargets.periodStart,
      periodEnd: schema.kpiTargets.periodEnd,
    })
    .from(schema.kpiTargets)
    .where(eq(schema.kpiTargets.id, id))
    .limit(1);
  if (!existing) throw errors.notFound("Target tidak ditemukan.");

  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(schema.kpiTargets)
      .where(eq(schema.kpiTargets.id, id))
      .returning({ id: schema.kpiTargets.id });
    if (!row) throw errors.notFound("Target tidak ditemukan.");
    const scope = await targetOfficeScope(tx, existing.stakeholderId);
    await appendTargetHistory(tx, [
      {
        targetId: id,
        stakeholderId: existing.stakeholderId,
        branchOfficeId: scope.branchOfficeId,
        regionalOfficeId: scope.regionalOfficeId,
        themeId: existing.themeId,
        subTheme: isSubTheme(existing.subTheme) ? existing.subTheme : null,
        periodStart: existing.periodStart,
        periodEnd: existing.periodEnd,
        targetCount: Number(existing.targetCount),
        changeType: "DELETED",
        actorId,
      },
    ]);
  });
  invalidateReadCache();
}
