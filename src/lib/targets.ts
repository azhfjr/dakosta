import "server-only";

import { and, asc, count, eq, gte, lt } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { errors } from "@/lib/errors";
import { achievementPercent, monthRange } from "@/lib/kpi/formulas";
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
};

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
      : (resolved[0]?.source ?? (subTheme ? "STAKEHOLDER_SUB_THEME" : "STAKEHOLDER"));
  return { target, source };
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}

export async function getTargetOverview(month: string): Promise<TargetOverview> {
  const db = getDb();
  const range = monthRange(month);

  const [targetRows, approvedRows] = await Promise.all([
    db
      .select({
        id: schema.kpiTargets.id,
        stakeholderId: schema.kpiTargets.stakeholderId,
        stakeholderName: schema.stakeholders.name,
        themeId: schema.kpiTargets.themeId,
        themeName: schema.themes.name,
        themeSlug: schema.themes.slug,
        subTheme: schema.kpiTargets.subTheme,
        targetCount: schema.kpiTargets.targetCount,
        periodStart: schema.kpiTargets.periodStart,
        periodEnd: schema.kpiTargets.periodEnd,
        updatedAt: schema.kpiTargets.updatedAt,
      })
      .from(schema.kpiTargets)
      .leftJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.kpiTargets.stakeholderId),
      )
      .leftJoin(schema.themes, eq(schema.themes.id, schema.kpiTargets.themeId))
      .where(
        and(
          eq(schema.kpiTargets.periodStart, range.startLocal),
          eq(schema.kpiTargets.periodEnd, range.endLocal),
        ),
      )
      .orderBy(
        asc(schema.kpiTargets.stakeholderId),
        asc(schema.kpiTargets.subTheme),
      ),
    db
      .select({
        stakeholderId: schema.contentSubmissions.stakeholderId,
        subTheme: schema.contentSubmissions.subTheme,
        themeId: schema.contentSubmissions.themeId,
        total: count(),
      })
      .from(schema.contentSubmissions)
      .where(
        and(
          eq(schema.contentSubmissions.status, "APPROVED"),
          gte(schema.contentSubmissions.approvedAt, range.startInstant),
          lt(schema.contentSubmissions.approvedAt, range.endInstant),
        ),
      )
      .groupBy(
        schema.contentSubmissions.stakeholderId,
        schema.contentSubmissions.subTheme,
        schema.contentSubmissions.themeId,
      ),
  ]);

  const byStakeholder = new Map<string, number>();
  const bySubTheme = new Map<string, number>();
  const byPair = new Map<string, number>();
  const byLegacyTheme = new Map<string, number>();
  let overall = 0;
  for (const row of approvedRows) {
    const total = Number(row.total);
    overall += total;
    byStakeholder.set(
      row.stakeholderId,
      (byStakeholder.get(row.stakeholderId) ?? 0) + total,
    );
    if (row.subTheme) {
      bySubTheme.set(row.subTheme, (bySubTheme.get(row.subTheme) ?? 0) + total);
      byPair.set(
        `${row.stakeholderId}:${row.subTheme}`,
        (byPair.get(`${row.stakeholderId}:${row.subTheme}`) ?? 0) + total,
      );
    } else if (row.themeId) {
      byLegacyTheme.set(
        row.themeId,
        (byLegacyTheme.get(row.themeId) ?? 0) + total,
      );
    }
  }

  const rows: TargetScopeRow[] = targetRows.map((row) => {
    const subTheme = targetSubTheme({
      subTheme: row.subTheme,
      themeSlug: row.themeSlug,
    });
    let approved: number;
    if (row.stakeholderId && subTheme) {
      approved = byPair.get(`${row.stakeholderId}:${subTheme}`) ?? 0;
    } else if (row.stakeholderId) {
      approved = byStakeholder.get(row.stakeholderId) ?? 0;
    } else if (subTheme) {
      approved = bySubTheme.get(subTheme) ?? 0;
    } else if (row.themeId) {
      approved = byLegacyTheme.get(row.themeId) ?? 0;
    } else {
      approved = overall;
    }
    return {
      id: row.id,
      stakeholderId: row.stakeholderId,
      stakeholderName: row.stakeholderName,
      themeId: row.themeId,
      themeName: row.themeName,
      subTheme,
      subThemeLabel: subTheme ? SUB_THEME_LABELS[subTheme] : null,
      targetCount: Number(row.targetCount),
      approved,
      achievement: achievementPercent(approved, Number(row.targetCount)),
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      updatedAt: row.updatedAt,
    };
  });

  const globalRow = rows.find(
    (row) => row.stakeholderId === null && row.subTheme === null,
  );
  const target = globalRow?.targetCount ?? null;
  const approved = globalRow?.approved ?? overall;

  return {
    month: range.key,
    periodLabel: range.label,
    rows,
    totals: {
      target: target ?? rows.reduce((sum, row) => sum + row.targetCount, 0),
      approved,
      achievement: achievementPercent(approved, target),
      scopes: rows.length,
      hasGlobal: globalRow !== undefined,
    },
  };
}

export type TargetStakeholderOption = { id: string; name: string };

export async function listTargetStakeholders(): Promise<TargetStakeholderOption[]> {
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
    const [row] = await db
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
    return { id: row.id };
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
  try {
    const [row] = await db
      .update(schema.kpiTargets)
      .set({
        ...(input.stakeholderId !== undefined
          ? { stakeholderId: input.stakeholderId }
          : {}),
        ...(input.subTheme !== undefined ? { subTheme: input.subTheme } : {}),
        ...(input.targetCount !== undefined
          ? { targetCount: input.targetCount }
          : {}),
        ...(input.reportingUnit !== undefined
          ? { reportingUnit: input.reportingUnit }
          : {}),
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(schema.kpiTargets.id, id))
      .returning({ id: schema.kpiTargets.id });
    if (!row) throw errors.notFound("Target tidak ditemukan.");
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw errors.conflict(
        "Target untuk cakupan dan periode ini sudah ada. Ubah target yang sudah ada.",
      );
    }
    throw error;
  }
}

export async function deleteTarget(id: string): Promise<void> {
  const [row] = await getDb()
    .delete(schema.kpiTargets)
    .where(eq(schema.kpiTargets.id, id))
    .returning({ id: schema.kpiTargets.id });
  if (!row) throw errors.notFound("Target tidak ditemukan.");
}
