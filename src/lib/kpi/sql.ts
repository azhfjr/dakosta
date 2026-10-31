import "server-only";

import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/db";
import { recordAudit } from "@/lib/audit";
import {
  contentScopePredicate,
  isOrganizationInScope,
  organizationScopePredicate,
} from "@/lib/authz/predicates";
import { getAccessibleStakeholderIds } from "@/lib/rbac";
import type { ContentStatus } from "@/lib/content-status";
import { errors } from "@/lib/errors";
import {
  achievementPercent,
  attributionLabel,
  average,
  dayKeys,
  isMonthKey,
  leadTimeDays,
  median,
  monthKeyFor,
  monthRange,
  percentChange,
  ratioPercent,
  recentMonthKeys,
  shortDayLabel,
  type AttributionMode,
  type DashboardOverview,
  type DrilldownItem,
  type KpiFilters,
  type KpiMetric,
  type MonthRange,
  type NamedTotal,
  type StatusTotal,
  type TargetSource,
} from "@/lib/kpi/formulas";
import type { SessionUser } from "@/lib/session";

export const kpiQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Bulan harus berformat YYYY-MM.")
    .optional(),
  attribution: z.enum(["approved_at", "date_created"]).optional(),
  stakeholderId: z.string().uuid().optional(),
  themeId: z.string().uuid().optional(),
});

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionalUuid(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = z.string().uuid().safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseKpiFiltersFromParams(
  params: Record<string, string | string[] | undefined>,
): KpiFilters {
  const month = firstValue(params.month);
  const attribution = firstValue(params.attribution);
  return {
    month: isMonthKey(month) ? month : monthKeyFor(),
    attribution: attribution === "approved_at" ? "approved_at" : "date_created",
    stakeholderId: optionalUuid(firstValue(params.stakeholderId)),
    themeId: optionalUuid(firstValue(params.themeId)),
  };
}

export function parseKpiFiltersFromQuery(searchParams: URLSearchParams): KpiFilters {
  const parsed = kpiQuerySchema.parse(Object.fromEntries(searchParams.entries()));
  return {
    month: parsed.month ?? monthKeyFor(),
    attribution: parsed.attribution ?? "date_created",
    stakeholderId: parsed.stakeholderId ?? null,
    themeId: parsed.themeId ?? null,
  };
}

export function monthOptions(selected: string, count = 6) {
  const keys = recentMonthKeys(new Date(), count);
  if (!keys.includes(selected)) keys.push(selected);
  return keys.map((key) => ({ key, label: monthRange(key).label }));
}

function whereAll(...parts: Array<SQL | undefined>): SQL | undefined {
  const present = parts.filter((part): part is SQL => Boolean(part));
  if (present.length === 0) return undefined;
  return and(...present);
}

function attributionCondition(range: MonthRange, mode: AttributionMode): SQL {
  return mode === "approved_at"
    ? and(
        gte(schema.contentSubmissions.approvedAt, range.startInstant),
        lt(schema.contentSubmissions.approvedAt, range.endInstant),
      )!
    : and(
        gte(schema.contentSubmissions.dateCreated, range.startLocal),
        lte(schema.contentSubmissions.dateCreated, range.endLocal),
      )!;
}

function submittedCondition(range: MonthRange): SQL {
  return and(
    gte(schema.contentSubmissions.submittedAt, range.startInstant),
    lt(schema.contentSubmissions.submittedAt, range.endInstant),
  )!;
}

function scopeConditions(user: SessionUser, filters: KpiFilters): SQL[] {
  const conditions: SQL[] = [];

  const scopePredicate = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  if (scopePredicate) conditions.push(scopePredicate);

  if (filters.stakeholderId) {
    conditions.push(
      eq(schema.contentSubmissions.stakeholderId, filters.stakeholderId),
    );
  }

  if (filters.themeId) {
    conditions.push(eq(schema.contentSubmissions.themeId, filters.themeId));
  }

  return conditions;
}

type TargetRow = {
  stakeholderId: string | null;
  themeId: string | null;
  targetCount: number;
};

function resolveTarget(
  role: SessionUser["role"],
  userStakeholderIds: string[],
  filters: KpiFilters,
  targetRows: TargetRow[],
): { target: number | null; source: TargetSource | null } {
  const find = (stakeholderId: string | null, themeId: string | null) =>
    targetRows.find(
      (row) => row.stakeholderId === stakeholderId && row.themeId === themeId,
    );

  if (role === "MASTER_ADMIN") {
    if (filters.stakeholderId && filters.themeId) {
      const row = find(filters.stakeholderId, filters.themeId);
      return { target: row?.targetCount ?? null, source: row ? "STAKEHOLDER_THEME" : null };
    }
    if (filters.stakeholderId) {
      const row = find(filters.stakeholderId, null);
      return { target: row?.targetCount ?? null, source: row ? "STAKEHOLDER" : null };
    }
    if (filters.themeId) {
      const row = find(null, filters.themeId);
      return { target: row?.targetCount ?? null, source: row ? "THEME" : null };
    }
    const row = find(null, null);
    return { target: row?.targetCount ?? null, source: row ? "GLOBAL" : null };
  }

  const owned = filters.stakeholderId
    ? userStakeholderIds.filter((id) => id === filters.stakeholderId)
    : userStakeholderIds;

  if (owned.length === 0) return { target: null, source: null };

  const scoped = owned.map((stakeholderId) =>
    find(stakeholderId, filters.themeId ?? null),
  );

  if (scoped.some((row) => !row)) {
    return { target: null, source: null };
  }

  const target = scoped.reduce((sum, row) => sum + (row?.targetCount ?? 0), 0);
  const source: TargetSource =
    owned.length > 1
      ? "AGGREGATE"
      : filters.themeId
        ? "STAKEHOLDER_THEME"
        : "STAKEHOLDER";

  return { target, source };
}

function toMetric(value: number, target: number | null, source: TargetSource | null): KpiMetric {
  return {
    value,
    target,
    achievement: achievementPercent(value, target),
    targetSource: source,
  };
}

function mapItems(
  rows: Array<Omit<DrilldownItem, "status"> & { status: string }>,
): DrilldownItem[] {
  return rows.map((row) => ({ ...row, status: row.status as ContentStatus }));
}

async function assertClientScope(
  user: SessionUser,
  filters: KpiFilters,
  route: string,
): Promise<void> {
  if (!filters.stakeholderId || user.scope.kind === "GLOBAL") return;
  const [organization] = await getDb()
    .select({
      id: schema.stakeholders.id,
      branchOfficeId: schema.stakeholders.branchOfficeId,
    })
    .from(schema.stakeholders)
    .where(eq(schema.stakeholders.id, filters.stakeholderId))
    .limit(1);
  if (!organization || !isOrganizationInScope(user.scope, organization)) {
    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "ACCESS_DENIED",
      recordType: "ORGANIZATION",
      recordId: filters.stakeholderId,
      after: { reason: "organization_scope_mismatch", route },
    });
    throw errors.forbidden("Anda tidak memiliki akses ke organisasi tersebut.");
  }
}

export async function getDashboardOverview(
  user: SessionUser,
  filters: KpiFilters,
): Promise<DashboardOverview> {
  await assertClientScope(user, filters, "/dashboard");

  const db = getDb();
  const range = monthRange(filters.month);
  const previousRange = monthRange(range.previousKey);
  const conditions = scopeConditions(user, filters);
  const scope = whereAll(...conditions);
  const approvedCurrent = whereAll(
    scope,
    eq(schema.contentSubmissions.status, "APPROVED"),
    attributionCondition(range, filters.attribution),
  );
  const approvedPrevious = whereAll(
    scope,
    eq(schema.contentSubmissions.status, "APPROVED"),
    attributionCondition(previousRange, filters.attribution),
  );
  const submittedInPeriod = whereAll(scope, submittedCondition(range));

  const trendDay =
    filters.attribution === "approved_at"
      ? sql<string>`to_char(${schema.contentSubmissions.approvedAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`
      : sql<string>`${schema.contentSubmissions.dateCreated}`;

  const itemColumns = {
    id: schema.contentSubmissions.id,
    referenceCode: schema.contentSubmissions.referenceCode,
    title: schema.contentSubmissions.title,
    status: schema.contentSubmissions.status,
    stakeholderId: schema.contentSubmissions.stakeholderId,
    stakeholderName: schema.stakeholders.name,
    themeId: schema.contentSubmissions.themeId,
    themeName: schema.themes.name,
    platform: schema.contentSubmissions.platform,
    dateCreated: schema.contentSubmissions.dateCreated,
    submittedAt: schema.contentSubmissions.submittedAt,
    approvedAt: schema.contentSubmissions.approvedAt,
    updatedAt: schema.contentSubmissions.updatedAt,
  };

  const [
    approvedRows,
    previousApprovedRows,
    statusRows,
    activeRows,
    trendRows,
    themeRows,
    themeCatalog,
    topStakeholderRows,
    approvedItems,
    pendingItems,
    recentItems,
    reviewRows,
    leadRows,
    targetRows,
    stakeholderRow,
    themeRow,
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(schema.contentSubmissions)
      .where(approvedCurrent),
    db
      .select({ total: count() })
      .from(schema.contentSubmissions)
      .where(approvedPrevious),
    db
      .select({ status: schema.contentSubmissions.status, total: count() })
      .from(schema.contentSubmissions)
      .where(submittedInPeriod)
      .groupBy(schema.contentSubmissions.status),
    db
      .select({
        total: countDistinct(schema.contentSubmissions.stakeholderId),
      })
      .from(schema.contentSubmissions)
      .where(submittedInPeriod),
    db
      .select({ day: trendDay, total: count() })
      .from(schema.contentSubmissions)
      .where(approvedCurrent)
      .groupBy(trendDay),
    db
      .select({
        themeId: schema.contentSubmissions.themeId,
        total: count(),
      })
      .from(schema.contentSubmissions)
      .where(approvedCurrent)
      .groupBy(schema.contentSubmissions.themeId),
    db
      .select({ id: schema.themes.id, name: schema.themes.name })
      .from(schema.themes)
      .where(eq(schema.themes.active, true))
      .orderBy(asc(schema.themes.sortOrder)),
    db
      .select({
        id: schema.stakeholders.id,
        name: schema.stakeholders.name,
        total: count(),
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(approvedCurrent)
      .groupBy(schema.stakeholders.id, schema.stakeholders.name)
      .orderBy(desc(count()))
      .limit(5),
    db
      .select(itemColumns)
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .innerJoin(
        schema.themes,
        eq(schema.themes.id, schema.contentSubmissions.themeId),
      )
      .where(approvedCurrent)
      .orderBy(
        filters.attribution === "approved_at"
          ? desc(schema.contentSubmissions.approvedAt)
          : desc(schema.contentSubmissions.dateCreated),
        desc(schema.contentSubmissions.updatedAt),
      )
      .limit(100),
    db
      .select(itemColumns)
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .innerJoin(
        schema.themes,
        eq(schema.themes.id, schema.contentSubmissions.themeId),
      )
      .where(
        whereAll(
          scope,
          inArray(schema.contentSubmissions.status, ["SUBMITTED", "IN_REVIEW"]),
          submittedCondition(range),
        ),
      )
      .orderBy(asc(schema.contentSubmissions.submittedAt))
      .limit(5),
    db
      .select(itemColumns)
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .innerJoin(
        schema.themes,
        eq(schema.themes.id, schema.contentSubmissions.themeId),
      )
      .where(scope)
      .orderBy(desc(schema.contentSubmissions.updatedAt))
      .limit(5),
    db
      .select({
        action: schema.contentReviews.action,
        total: count(),
      })
      .from(schema.contentReviews)
      .innerJoin(
        schema.contentSubmissions,
        eq(schema.contentSubmissions.id, schema.contentReviews.submissionId),
      )
      .where(
        whereAll(
          scope,
          gte(schema.contentReviews.createdAt, range.startInstant),
          lt(schema.contentReviews.createdAt, range.endInstant),
        ),
      )
      .groupBy(schema.contentReviews.action),
    db
      .select({
        submittedAt: schema.contentSubmissions.submittedAt,
        decidedAt: schema.contentReviews.createdAt,
      })
      .from(schema.contentReviews)
      .innerJoin(
        schema.contentSubmissions,
        eq(schema.contentSubmissions.id, schema.contentReviews.submissionId),
      )
      .where(
        whereAll(
          scope,
          eq(schema.contentReviews.action, "APPROVE"),
          isNotNull(schema.contentSubmissions.submittedAt),
          gte(schema.contentReviews.createdAt, range.startInstant),
          lt(schema.contentReviews.createdAt, range.endInstant),
        ),
      ),
    db
      .select({
        stakeholderId: schema.kpiTargets.stakeholderId,
        themeId: schema.kpiTargets.themeId,
        targetCount: schema.kpiTargets.targetCount,
      })
      .from(schema.kpiTargets)
      .where(
        and(
          eq(schema.kpiTargets.periodStart, range.startLocal),
          eq(schema.kpiTargets.periodEnd, range.endLocal),
        ),
      )
      .orderBy(desc(schema.kpiTargets.createdAt)),
    filters.stakeholderId
      ? db
          .select({ name: schema.stakeholders.name })
          .from(schema.stakeholders)
          .where(eq(schema.stakeholders.id, filters.stakeholderId))
          .limit(1)
      : Promise.resolve([] as Array<{ name: string }>),
    filters.themeId
      ? db
          .select({ name: schema.themes.name })
          .from(schema.themes)
          .where(eq(schema.themes.id, filters.themeId))
          .limit(1)
      : Promise.resolve([] as Array<{ name: string }>),
  ]);

  const approvedValue = Number(approvedRows[0]?.total ?? 0);
  const previousApproved = Number(previousApprovedRows[0]?.total ?? 0);
  const reviewed = reviewRows.reduce((sum, row) => sum + Number(row.total), 0);
  const approveDecisions = reviewRows
    .filter((row) => row.action === "APPROVE")
    .reduce((sum, row) => sum + Number(row.total), 0);

  const leadValues = leadRows
    .map((row) => leadTimeDays(row.submittedAt, row.decidedAt))
    .filter((value): value is number => value !== null);

  const ownedStakeholderIds =
    user.scope.kind === "GLOBAL"
      ? []
      : (await getAccessibleStakeholderIds(user));
  const resolvedTarget = resolveTarget(
    user.role,
    ownedStakeholderIds,
    filters,
    targetRows.map((row) => ({
      stakeholderId: row.stakeholderId,
      themeId: row.themeId,
      targetCount: Number(row.targetCount),
    })),
  );

  const statusCounts: StatusTotal[] = statusRows.map((row) => ({
    status: row.status as ContentStatus,
    total: Number(row.total),
  }));

  const submitted = statusCounts.reduce((sum, row) => sum + row.total, 0);
  const pending = statusCounts
    .filter((row) => row.status === "SUBMITTED" || row.status === "IN_REVIEW")
    .reduce((sum, row) => sum + row.total, 0);
  const revision = statusCounts
    .filter((row) => row.status === "REVISION_REQUIRED")
    .reduce((sum, row) => sum + row.total, 0);

  const trendMap = new Map(trendRows.map((row) => [row.day, Number(row.total)]));
  const trend = dayKeys(range).map((date) => ({
    date,
    label: shortDayLabel(date),
    total: trendMap.get(date) ?? 0,
  }));

  const themeMap = new Map(
    themeRows.map((row) => [row.themeId, Number(row.total)]),
  );
  const themes: NamedTotal[] = themeCatalog.map((theme) => ({
    id: theme.id,
    name: theme.name,
    total: themeMap.get(theme.id) ?? 0,
  }));

  const stakeholders: NamedTotal[] = topStakeholderRows.map((row) => ({
    id: row.id,
    name: row.name,
    total: Number(row.total),
  }));

  return {
    filters,
    period: {
      key: range.key,
      label: range.label,
      startLocal: range.startLocal,
      endLocal: range.endLocal,
      attributionLabel: attributionLabel(filters.attribution),
    },
    scope: {
      role: user.role,
      restricted: user.scope.kind !== "GLOBAL",
      stakeholderIds: ownedStakeholderIds,
      stakeholderName: stakeholderRow[0]?.name ?? null,
      themeName: themeRow[0]?.name ?? null,
    },
    approved: toMetric(approvedValue, resolvedTarget.target, resolvedTarget.source),
    previousApproved,
    growth: percentChange(approvedValue, previousApproved),
    submitted,
    pending,
    revision,
    reviewed,
    approvedDecisions: approveDecisions,
    approvalRate: ratioPercent(approveDecisions, reviewed),
    leadTimeMedianDays: median(leadValues),
    leadTimeAverageDays: average(leadValues),
    approvalSamples: leadValues.length,
    activeStakeholders: Number(activeRows[0]?.total ?? 0),
    statusCounts,
    trend,
    themes,
    stakeholders,
    approvedItems: mapItems(approvedItems),
    pendingItems: mapItems(pendingItems),
    recentItems: mapItems(recentItems),
    generatedAt: new Date(),
  };
}

export type MonthlyTrendPoint = {
  month: string;
  label: string;
  approved: number;
  submitted: number;
};

export async function getMonthlyTrend(
  user: SessionUser,
  filters: KpiFilters,
  months = 6,
): Promise<MonthlyTrendPoint[]> {
  await assertClientScope(user, filters, "/analitik");

  const keys = recentMonthKeys(new Date(), months).reverse();
  const firstRange = monthRange(keys[0]!);
  const lastRange = monthRange(keys[keys.length - 1]!);
  const scope = whereAll(...scopeConditions(user, filters));

  const approvedMonth =
    filters.attribution === "approved_at"
      ? sql<string>`to_char(${schema.contentSubmissions.approvedAt} at time zone 'Asia/Jakarta', 'YYYY-MM')`
      : sql<string>`substring(${schema.contentSubmissions.dateCreated} from 1 for 7)`;

  const approvedWhere = whereAll(
    scope,
    eq(schema.contentSubmissions.status, "APPROVED"),
    filters.attribution === "approved_at"
      ? and(
          gte(schema.contentSubmissions.approvedAt, firstRange.startInstant),
          lt(schema.contentSubmissions.approvedAt, lastRange.endInstant),
        )
      : and(
          gte(schema.contentSubmissions.dateCreated, firstRange.startLocal),
          lte(schema.contentSubmissions.dateCreated, lastRange.endLocal),
        ),
  );

  const submittedMonth = sql<string>`to_char(${schema.contentSubmissions.submittedAt} at time zone 'Asia/Jakarta', 'YYYY-MM')`;

  const submittedWhere = whereAll(
    scope,
    gte(schema.contentSubmissions.submittedAt, firstRange.startInstant),
    lt(schema.contentSubmissions.submittedAt, lastRange.endInstant),
  );

  const db = getDb();
  const [approvedRows, submittedRows] = await Promise.all([
    db
      .select({ month: approvedMonth, total: count() })
      .from(schema.contentSubmissions)
      .where(approvedWhere)
      .groupBy(approvedMonth),
    db
      .select({ month: submittedMonth, total: count() })
      .from(schema.contentSubmissions)
      .where(submittedWhere)
      .groupBy(submittedMonth),
  ]);

  const approvedMap = new Map(
    approvedRows.map((row) => [row.month, Number(row.total)]),
  );
  const submittedMap = new Map(
    submittedRows.map((row) => [row.month, Number(row.total)]),
  );

  return keys.map((key) => ({
    month: key,
    label: monthRange(key).shortLabel,
    approved: approvedMap.get(key) ?? 0,
    submitted: submittedMap.get(key) ?? 0,
  }));
}

export async function getTopStakeholderTotals(
  user: SessionUser,
  filters: KpiFilters,
  limit = 10,
): Promise<NamedTotal[]> {
  await assertClientScope(user, filters, "/analitik");

  const range = monthRange(filters.month);
  const rows = await getDb()
    .select({
      id: schema.stakeholders.id,
      name: schema.stakeholders.name,
      total: count(),
    })
    .from(schema.contentSubmissions)
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    )
    .where(
      whereAll(
        ...scopeConditions(user, filters),
        eq(schema.contentSubmissions.status, "APPROVED"),
        attributionCondition(range, filters.attribution),
      ),
    )
    .groupBy(schema.stakeholders.id, schema.stakeholders.name)
    .orderBy(desc(count()))
    .limit(Math.min(Math.max(limit, 1), 50));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    total: Number(row.total),
  }));
}

export async function getKpiFilterOptions(user: SessionUser) {
  const db = getDb();
  const stakeholderScope = organizationScopePredicate(user.scope, {
    id: schema.stakeholders.id,
    branchId: schema.stakeholders.branchOfficeId,
  });

  const [stakeholders, themes] = await Promise.all([
    db
      .select({ id: schema.stakeholders.id, name: schema.stakeholders.name })
      .from(schema.stakeholders)
      .where(
        whereAll(eq(schema.stakeholders.status, "ACTIVE"), stakeholderScope),
      )
      .orderBy(asc(schema.stakeholders.name)),
    db
      .select({ id: schema.themes.id, name: schema.themes.name })
      .from(schema.themes)
      .where(eq(schema.themes.active, true))
      .orderBy(asc(schema.themes.sortOrder)),
  ]);

  return { stakeholders, themes };
}
