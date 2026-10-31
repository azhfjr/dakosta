import "server-only";

import {
  and,
  asc,
  count,
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
import {
  isPendingStatus,
  PENDING_STATUSES,
  type ContentStatus,
} from "@/lib/content-status";
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
import { resolveAggregateTarget, resolveTargetAmount } from "@/lib/targets";
import {
  isSubTheme,
  SUB_THEMES,
  SUB_THEME_LABELS,
  type SubTheme,
} from "@/lib/taxonomy";

export const kpiQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Bulan harus berformat YYYY-MM.")
    .optional(),
  attribution: z.enum(["approved_at", "date_created"]).optional(),
  stakeholderId: z.string().uuid().optional(),
  subTheme: z.enum(SUB_THEMES).optional(),
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
  const subTheme = firstValue(params.subTheme);
  return {
    month: isMonthKey(month) ? month : monthKeyFor(),
    attribution: attribution === "approved_at" ? "approved_at" : "date_created",
    stakeholderId: optionalUuid(firstValue(params.stakeholderId)),
    subTheme: isSubTheme(subTheme) ? subTheme : null,
  };
}

export function parseKpiFiltersFromQuery(searchParams: URLSearchParams): KpiFilters {
  const parsed = kpiQuerySchema.parse(Object.fromEntries(searchParams.entries()));
  return {
    month: parsed.month ?? monthKeyFor(),
    attribution: parsed.attribution ?? "date_created",
    stakeholderId: parsed.stakeholderId ?? null,
    subTheme: (parsed.subTheme as SubTheme | undefined) ?? null,
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

  if (filters.subTheme) {
    conditions.push(eq(schema.contentSubmissions.subTheme, filters.subTheme));
  }

  return conditions;
}

type TargetRow = {
  stakeholderId: string | null;
  subTheme: string | null;
  themeId: string | null;
  targetCount: number;
};

function resolveTarget(
  role: SessionUser["role"],
  userStakeholderIds: string[],
  filters: KpiFilters,
  targetRows: TargetRow[],
): { target: number | null; source: TargetSource | null } {
  if (role === "MASTER_ADMIN") {
    return resolveTargetAmount(targetRows, {
      stakeholderId: filters.stakeholderId,
      subTheme: filters.subTheme,
    });
  }

  const owned = filters.stakeholderId
    ? userStakeholderIds.filter((id) => id === filters.stakeholderId)
    : userStakeholderIds;

  return resolveAggregateTarget(targetRows, owned, filters.subTheme);
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
  rows: Array<
    Omit<DrilldownItem, "status" | "subTheme" | "themeName"> & {
      status: string;
      subTheme: string | null;
      themeName: string | null;
    }
  >,
): DrilldownItem[] {
  return rows.map((row) => {
    const subTheme = isSubTheme(row.subTheme) ? row.subTheme : null;
    return {
      ...row,
      status: row.status as ContentStatus,
      subTheme,
      themeName:
        row.themeName ?? (subTheme ? SUB_THEME_LABELS[subTheme] : "Tanpa tema"),
    };
  });
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
    subTheme: schema.contentSubmissions.subTheme,
    themeName: schema.themes.name,
    platform: schema.contentSubmissions.platform,
    contentType: schema.contentSubmissions.contentType,
    dateCreated: schema.contentSubmissions.dateCreated,
    submittedAt: schema.contentSubmissions.submittedAt,
    approvedAt: schema.contentSubmissions.approvedAt,
    updatedAt: schema.contentSubmissions.updatedAt,
  };

  const [
    countRows,
    statusRows,
    trendRows,
    themeRows,
    topStakeholderRows,
    approvedItems,
    pendingItems,
    recentItems,
    reviewRows,
    leadRows,
    targetRows,
    stakeholderRow,
    ownedStakeholderIds,
  ] = await Promise.all([
    db
      .select({
        approvedCurrent: sql<number>`count(*) filter (where ${approvedCurrent})`,
        approvedPrevious: sql<number>`count(*) filter (where ${approvedPrevious})`,
        activeStakeholders: sql<number>`count(distinct ${schema.contentSubmissions.stakeholderId}) filter (where ${submittedInPeriod})`,
      })
      .from(schema.contentSubmissions)
      .where(scope),
    db
      .select({ status: schema.contentSubmissions.status, total: count() })
      .from(schema.contentSubmissions)
      .where(submittedInPeriod)
      .groupBy(schema.contentSubmissions.status),
    db
      .select({ day: trendDay, total: count() })
      .from(schema.contentSubmissions)
      .where(approvedCurrent)
      .groupBy(trendDay),
    db
      .select({
        subTheme: schema.contentSubmissions.subTheme,
        total: count(),
      })
      .from(schema.contentSubmissions)
      .where(approvedCurrent)
      .groupBy(schema.contentSubmissions.subTheme),
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
      .leftJoin(
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
      .leftJoin(
        schema.themes,
        eq(schema.themes.id, schema.contentSubmissions.themeId),
      )
      .where(
        whereAll(
          scope,
          inArray(schema.contentSubmissions.status, [...PENDING_STATUSES]),
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
      .leftJoin(
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
        subTheme: schema.kpiTargets.subTheme,
        themeId: schema.kpiTargets.themeId,
        themeSlug: schema.themes.slug,
        targetCount: schema.kpiTargets.targetCount,
      })
      .from(schema.kpiTargets)
      .leftJoin(schema.themes, eq(schema.themes.id, schema.kpiTargets.themeId))
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
    user.scope.kind === "GLOBAL"
      ? Promise.resolve([] as string[])
      : getAccessibleStakeholderIds(user),
  ]);

  const approvedValue = Number(countRows[0]?.approvedCurrent ?? 0);
  const previousApproved = Number(countRows[0]?.approvedPrevious ?? 0);
  const activeStakeholderCount = Number(countRows[0]?.activeStakeholders ?? 0);
  const reviewed = reviewRows.reduce((sum, row) => sum + Number(row.total), 0);
  const approveDecisions = reviewRows
    .filter((row) => row.action === "APPROVE")
    .reduce((sum, row) => sum + Number(row.total), 0);

  const leadValues = leadRows
    .map((row) => leadTimeDays(row.submittedAt, row.decidedAt))
    .filter((value): value is number => value !== null);

  const resolvedTarget = resolveTarget(
    user.role,
    ownedStakeholderIds,
    filters,
    targetRows.map((row) => ({
      stakeholderId: row.stakeholderId,
      subTheme: row.subTheme,
      themeId: row.themeId,
      themeSlug: row.themeSlug,
      targetCount: Number(row.targetCount),
    })),
  );

  const statusCounts: StatusTotal[] = statusRows.map((row) => ({
    status: row.status as ContentStatus,
    total: Number(row.total),
  }));

  const submitted = statusCounts.reduce((sum, row) => sum + row.total, 0);
  const pending = statusCounts
    .filter((row) => isPendingStatus(row.status))
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
    themeRows.map((row) => [row.subTheme, Number(row.total)]),
  );
  const themes: NamedTotal[] = SUB_THEMES.map((subTheme) => ({
    id: subTheme,
    name: SUB_THEME_LABELS[subTheme],
    total: themeMap.get(subTheme) ?? 0,
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
      themeName: filters.subTheme ? SUB_THEME_LABELS[filters.subTheme] : null,
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
    activeStakeholders: activeStakeholderCount,
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
      : sql<string>`to_char(${schema.contentSubmissions.dateCreated}, 'YYYY-MM')`;

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

  const stakeholders = await db
    .select({ id: schema.stakeholders.id, name: schema.stakeholders.name })
    .from(schema.stakeholders)
    .where(whereAll(eq(schema.stakeholders.status, "ACTIVE"), stakeholderScope))
    .orderBy(asc(schema.stakeholders.name));

  const themes = SUB_THEMES.map((subTheme) => ({
    id: subTheme,
    name: SUB_THEME_LABELS[subTheme],
  }));

  return { stakeholders, themes };
}
