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
} from "@/lib/authz/predicates";
import { getAccessibleStakeholderIds } from "@/lib/rbac";
import {
  isPendingStatus,
  PENDING_STATUSES,
  type ContentStatus,
} from "@/lib/content-status";
import { errors } from "@/lib/errors";
import { cachedRead, readCacheKey } from "@/lib/read-cache";
import {
  achievementPercent,
  attributionLabel,
  average,
  dayKeys,
  leadTimeDays,
  median,
  monthRange,
  percentChange,
  ratioPercent,
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
import {
  parsePeriod,
  periodMonthKeys,
  previousPeriod,
  type Period,
} from "@/lib/periods";
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
  period: z
    .string()
    .regex(
      /^(\d{4}-(0[1-9]|1[0-2])|\d{4}-Q[1-4]|\d{4})$/,
      "Periode tidak valid.",
    )
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
  const periodKey = firstValue(params.period);
  const month = firstValue(params.month);
  const period = parsePeriod(periodKey ?? month);
  const attribution = firstValue(params.attribution);
  const subTheme = firstValue(params.subTheme);
  return {
    month:
      period.granularity === "MONTH"
        ? period.key
        : period.startDate.slice(0, 7),
    periodKey: period.key,
    attribution:
      attribution === "date_created" ? "date_created" : "approved_at",
    stakeholderId: optionalUuid(firstValue(params.stakeholderId)),
    subTheme: isSubTheme(subTheme) ? subTheme : null,
  };
}

export function parseKpiFiltersFromQuery(
  searchParams: URLSearchParams,
): KpiFilters {
  const parsed = kpiQuerySchema.parse(
    Object.fromEntries(searchParams.entries()),
  );
  const period = parsePeriod(parsed.period ?? parsed.month);
  return {
    month:
      period.granularity === "MONTH"
        ? period.key
        : period.startDate.slice(0, 7),
    periodKey: period.key,
    attribution: parsed.attribution ?? "approved_at",
    stakeholderId: parsed.stakeholderId ?? null,
    subTheme: (parsed.subTheme as SubTheme | undefined) ?? null,
  };
}

export function kpiPeriod(filters: KpiFilters): Period {
  return parsePeriod(filters.periodKey ?? filters.month);
}

function rangeFor(period: Period): MonthRange {
  const previous = previousPeriod(period);
  return {
    key: period.key,
    previousKey: previous.key,
    label: period.label,
    shortLabel: period.label,
    startInstant: period.start,
    endInstant: period.endExclusive,
    startLocal: period.startDate,
    endLocal: period.endDate,
    dayCount: Math.round(
      (period.endExclusive.getTime() - period.start.getTime()) / 86_400_000,
    ),
  };
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

function toMetric(
  value: number,
  target: number | null,
  source: TargetSource | null,
): KpiMetric {
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
  // Scope must be checked even when the cached value is served.
  await assertClientScope(user, filters, "/dashboard");
  return cachedRead(
    readCacheKey(user, [
      "dashboard-overview",
      filters.periodKey ?? filters.month,
      filters.attribution,
      filters.stakeholderId,
      filters.subTheme,
    ]),
    () => loadDashboardOverview(user, filters),
  );
}

async function loadDashboardOverview(
  user: SessionUser,
  filters: KpiFilters,
): Promise<DashboardOverview> {
  const db = getDb();
  const period = kpiPeriod(filters);
  const range = rangeFor(period);
  const previousRange = rangeFor(previousPeriod(period));
  const periodMonths = periodMonthKeys(period);
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

  const trendBucket = period.granularity === "MONTH" ? "day" : "month";
  // Format must be a literal, not a bound parameter: Postgres treats `$1` and
  // `$5` as different expressions and rejects the GROUP BY as non-matching.
  const trendFormat = sql.raw(
    trendBucket === "day" ? "'YYYY-MM-DD'" : "'YYYY-MM'",
  );
  const trendDay =
    filters.attribution === "approved_at"
      ? sql<string>`to_char(${schema.contentSubmissions.approvedAt} at time zone 'Asia/Jakarta', ${trendFormat})`
      : sql<string>`to_char(${schema.contentSubmissions.dateCreated}, ${trendFormat})`;

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
        periodStart: schema.kpiTargets.periodStart,
      })
      .from(schema.kpiTargets)
      .leftJoin(schema.themes, eq(schema.themes.id, schema.kpiTargets.themeId))
      .where(
        inArray(
          schema.kpiTargets.periodStart,
          periodMonths.map((key) => `${key}-01`),
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

  const resolvedTarget = (() => {
    let total = 0;
    let found = false;
    let source: TargetSource | null = null;
    for (const monthKey of periodMonths) {
      const monthStart = `${monthKey}-01`;
      const resolved = resolveTarget(
        user.role,
        ownedStakeholderIds,
        filters,
        targetRows
          .filter((row) => row.periodStart === monthStart)
          .map((row) => ({
            stakeholderId: row.stakeholderId,
            subTheme: row.subTheme,
            themeId: row.themeId,
            themeSlug: row.themeSlug,
            targetCount: Number(row.targetCount),
          })),
      );
      if (resolved.target !== null) {
        total += resolved.target;
        found = true;
        source = source ?? resolved.source;
      }
    }
    if (!found) return { target: null, source: null };
    return {
      target: total,
      source: periodMonths.length === 1 ? source : ("AGGREGATE" as const),
    };
  })();

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

  const trendMap = new Map(
    trendRows.map((row) => [row.day, Number(row.total)]),
  );
  const trend =
    trendBucket === "day"
      ? dayKeys(range).map((date) => ({
          date,
          label: shortDayLabel(date),
          total: trendMap.get(date) ?? 0,
        }))
      : periodMonths.map((key) => {
          const month = monthRange(key);
          return {
            date: key,
            label: month.shortLabel,
            total: trendMap.get(key) ?? 0,
          };
        });

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
    approved: toMetric(
      approvedValue,
      resolvedTarget.target,
      resolvedTarget.source,
    ),
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
