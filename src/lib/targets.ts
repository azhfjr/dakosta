import "server-only";

import { and, asc, count, eq, gte, lt } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { achievementPercent, monthRange } from "@/lib/kpi/formulas";

export type TargetScopeRow = {
  id: string;
  stakeholderId: string | null;
  stakeholderName: string | null;
  themeId: string | null;
  themeName: string | null;
  targetCount: number;
  approved: number;
  achievement: number | null;
  periodStart: string;
  periodEnd: string;
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
  };
};

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
        targetCount: schema.kpiTargets.targetCount,
        periodStart: schema.kpiTargets.periodStart,
        periodEnd: schema.kpiTargets.periodEnd,
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
        asc(schema.kpiTargets.themeId),
      ),
    db
      .select({
        stakeholderId: schema.contentSubmissions.stakeholderId,
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
        schema.contentSubmissions.themeId,
      ),
  ]);

  const byStakeholder = new Map<string, number>();
  const byTheme = new Map<string, number>();
  const byPair = new Map<string, number>();
  let overall = 0;
  for (const row of approvedRows) {
    const total = Number(row.total);
    overall += total;
    byStakeholder.set(
      row.stakeholderId,
      (byStakeholder.get(row.stakeholderId) ?? 0) + total,
    );
    byTheme.set(row.themeId, (byTheme.get(row.themeId) ?? 0) + total);
    byPair.set(`${row.stakeholderId}:${row.themeId}`, total);
  }

  const rows: TargetScopeRow[] = targetRows.map((row) => {
    let approved: number;
    if (row.stakeholderId && row.themeId) {
      approved = byPair.get(`${row.stakeholderId}:${row.themeId}`) ?? 0;
    } else if (row.stakeholderId) {
      approved = byStakeholder.get(row.stakeholderId) ?? 0;
    } else if (row.themeId) {
      approved = byTheme.get(row.themeId) ?? 0;
    } else {
      approved = overall;
    }
    return {
      ...row,
      targetCount: Number(row.targetCount),
      approved,
      achievement: achievementPercent(approved, Number(row.targetCount)),
    };
  });

  const latestGlobal = rows.find(
    (row) => row.stakeholderId === null && row.themeId === null,
  );
  const target = latestGlobal?.targetCount ?? null;
  const approved = latestGlobal?.approved ?? overall;

  return {
    month: range.key,
    periodLabel: range.label,
    rows,
    totals: {
      target: target ?? rows.reduce((sum, row) => sum + row.targetCount, 0),
      approved,
      achievement: achievementPercent(approved, target),
      scopes: rows.length,
    },
  };
}
