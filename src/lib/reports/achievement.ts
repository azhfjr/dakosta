import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  contentScopePredicate,
  organizationScopePredicate,
} from "@/lib/authz/predicates";
import {
  orgSourceCondition,
  ORG_SOURCE_LABELS,
  sourceOfOrganization,
  type OrgSource,
} from "@/lib/analytics/source";
import type { ContentStatus } from "@/lib/content-status";
import { monthRange, type KpiFilters } from "@/lib/kpi/formulas";
import type { SessionUser } from "@/lib/session";
import {
  resolveTargetAmount,
  type TargetOverview,
} from "@/lib/targets";
import { getTargetOverview } from "@/lib/targets";
import { SUB_THEME_LABELS, type SubTheme } from "@/lib/taxonomy";
import { achievementPercent } from "@/lib/kpi/formulas";

export type AchievementReportFilters = KpiFilters & {
  sources: OrgSource[];
};

export type AchievementReportRow = {
  id: string;
  referenceCode: string;
  title: string | null;
  organization: string;
  branchName: string | null;
  source: OrgSource;
  contentType: string | null;
  subTheme: string | null;
  status: ContentStatus;
  dateCreated: string;
  approvedAt: Date | null;
  decidedBy: string | null;
};

export type AchievementOrganizationRow = {
  id: string;
  name: string;
  branchName: string | null;
  source: OrgSource;
  approved: number;
  target: number | null;
  achievement: number | null;
  targetSource: string | null;
};

export type AchievementSourceRow = {
  source: OrgSource;
  label: string;
  organizations: number;
  approved: number;
  target: number | null;
  achievement: number | null;
};

export type AchievementReport = {
  generatedAt: Date;
  month: string;
  periodLabel: string;
  scope: {
    role: string;
    label: string;
    organizationName: string | null;
  };
  totals: {
    approved: number;
    approvedByBranch: number;
    target: number | null;
    achievement: number | null;
    targetSource: string | null;
    organizations: number;
    contentTypes: Array<{ label: string; total: number }>;
  };
  sources: AchievementSourceRow[];
  organizations: AchievementOrganizationRow[];
  rows: AchievementReportRow[];
  truncated: boolean;
};

const reviewerRoleSubquery = sql<string | null>`(
  select cr.reviewer_role from content_reviews cr
  where cr.submission_id = ${schema.contentSubmissions.id}
  order by cr.created_at desc limit 1
)`;

function targetForOrganization(
  targets: TargetOverview,
  organizationId: string,
  subTheme: SubTheme | null,
) {
  const keys = targets.rows.map((row) => ({
    stakeholderId: row.stakeholderId,
    themeId: row.themeId,
    subTheme: row.subTheme,
    targetCount: row.targetCount,
  }));
  const chain: Array<{ stakeholderId: string | null; subTheme: SubTheme | null }> =
    [];
  if (subTheme) chain.push({ stakeholderId: organizationId, subTheme });
  chain.push({ stakeholderId: organizationId, subTheme: null });
  if (subTheme) chain.push({ stakeholderId: null, subTheme });
  chain.push({ stakeholderId: null, subTheme: null });
  for (const candidate of chain) {
    const resolved = resolveTargetAmount(keys, candidate);
    if (resolved.source) return resolved;
  }
  return { target: null, source: null };
}

export async function getAchievementReport(
  user: SessionUser,
  filters: AchievementReportFilters,
): Promise<AchievementReport> {
  const db = getDb();
  const range = monthRange(filters.month);

  const contentConditions: SQL[] = [
    eq(schema.contentSubmissions.archived, false),
    eq(schema.contentSubmissions.status, "APPROVED"),
    gte(schema.contentSubmissions.approvedAt, range.startInstant),
    lt(schema.contentSubmissions.approvedAt, range.endInstant),
  ];
  const scope = contentScopePredicate(
    user,
    schema.contentSubmissions.stakeholderId,
  );
  if (scope) contentConditions.push(scope);
  if (filters.stakeholderId) {
    contentConditions.push(
      eq(schema.contentSubmissions.stakeholderId, filters.stakeholderId),
    );
  }
  if (filters.subTheme) {
    contentConditions.push(
      eq(schema.contentSubmissions.subTheme, filters.subTheme),
    );
  }
  const sourceCondition = orgSourceCondition(
    schema.contentSubmissions.stakeholderId,
    filters.sources,
  );
  if (sourceCondition) contentConditions.push(sourceCondition);

  const orgScope = organizationScopePredicate(user.scope, {
    id: schema.stakeholders.id,
    branchId: schema.stakeholders.branchOfficeId,
  });

  const [rows, contentTotals, organizations, targets] = await Promise.all([
    db
      .select({
        id: schema.contentSubmissions.id,
        referenceCode: schema.contentSubmissions.referenceCode,
        title: schema.contentSubmissions.title,
        organization: schema.stakeholders.name,
        branchName: schema.branchOffices.name,
        organizationType: schema.stakeholders.organizationType,
        faskesClass: schema.stakeholders.faskesClass,
        contentType: schema.contentSubmissions.contentType,
        subTheme: schema.contentSubmissions.subTheme,
        status: schema.contentSubmissions.status,
        dateCreated: schema.contentSubmissions.dateCreated,
        approvedAt: schema.contentSubmissions.approvedAt,
        decidedBy: reviewerRoleSubquery,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .leftJoin(
        schema.branchOffices,
        eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
      )
      .where(and(...contentConditions))
      .orderBy(desc(schema.contentSubmissions.approvedAt))
      .limit(1000),
    db
      .select({
        total: count(),
        branchApproved: sql<number>`count(*) filter (where ${reviewerRoleSubquery} = 'BRANCH_ADMIN')`,
      })
      .from(schema.contentSubmissions)
      .innerJoin(
        schema.stakeholders,
        eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
      )
      .where(and(...contentConditions)),
    db
      .select({
        id: schema.stakeholders.id,
        name: schema.stakeholders.name,
        organizationType: schema.stakeholders.organizationType,
        faskesClass: schema.stakeholders.faskesClass,
        branchName: schema.branchOffices.name,
      })
      .from(schema.stakeholders)
      .leftJoin(
        schema.branchOffices,
        eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
      )
      .where(
        and(
          orgScope,
          eq(schema.stakeholders.status, "ACTIVE"),
          ...(filters.stakeholderId
            ? [eq(schema.stakeholders.id, filters.stakeholderId)]
            : []),
        ),
      )
      .orderBy(asc(schema.stakeholders.name)),
    getTargetOverview(filters.month),
  ]);

  const approvedByOrganization = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  for (const row of rows) {
    approvedByOrganization.set(
      row.organization,
      (approvedByOrganization.get(row.organization) ?? 0) + 1,
    );
    const typeLabel =
      row.contentType === "VIDEO"
        ? "Video"
        : row.contentType === "INFOGRAFIS"
          ? "Infografis"
          : "Belum ditentukan";
    typeCounts.set(typeLabel, (typeCounts.get(typeLabel) ?? 0) + 1);
  }

  const organizationRows: AchievementOrganizationRow[] = organizations.map((org) => {
    const approved = approvedByOrganization.get(org.name) ?? 0;
    const resolved = targetForOrganization(targets, org.id, filters.subTheme);
    return {
      id: org.id,
      name: org.name,
      branchName: org.branchName,
      source: sourceOfOrganization(org),
      approved,
      target: resolved.target,
      achievement: achievementPercent(approved, resolved.target),
      targetSource: resolved.source,
    };
  });

  const sourceTotals = new Map<
    OrgSource,
    { organizations: number; approved: number; target: number | null }
  >();
  for (const row of organizationRows) {
    const current =
      sourceTotals.get(row.source) ??
      { organizations: 0, approved: 0, target: 0 };
    current.organizations += 1;
    current.approved += row.approved;
    if (row.target !== null) current.target = (current.target ?? 0) + row.target;
    sourceTotals.set(row.source, current);
  }
  const sources: AchievementSourceRow[] = (
    ["FASKES_FKTP", "FASKES_FKRTL", "PEMDA", "OTHER"] as OrgSource[]
  )
    .filter((source) => sourceTotals.has(source))
    .map((source) => {
      const value = sourceTotals.get(source)!;
      return {
        source,
        label: ORG_SOURCE_LABELS[source],
        organizations: value.organizations,
        approved: value.approved,
        target: value.target,
        achievement: achievementPercent(value.approved, value.target),
      };
    });

  const globalRow = targets.rows.find(
    (row) => row.stakeholderId === null && row.subTheme === null,
  );
  const organizationTargetSum = organizationRows.reduce(
    (sum, row) => sum + (row.target ?? 0),
    0,
  );
  const anyOrganizationTarget = organizationRows.some(
    (row) => row.target !== null,
  );
  const totalTarget =
    globalRow?.targetCount ??
    (anyOrganizationTarget ? organizationTargetSum : null);
  const totalTargetSource = globalRow
    ? "GLOBAL"
    : anyOrganizationTarget
      ? "AGGREGATE"
      : null;
  const totalApproved = Number(contentTotals[0]?.total ?? 0);
  const ownOrganizationId =
    user.scope.kind === "ORG" ? user.scope.organizationId : null;
  const organizationName = ownOrganizationId
    ? (organizationRows.find((row) => row.id === ownOrganizationId)?.name ??
      user.scopeLabel)
    : null;

  return {
    generatedAt: new Date(),
    month: range.key,
    periodLabel: range.label,
    scope: {
      role: user.role,
      label: user.scopeLabel,
      organizationName,
    },
    totals: {
      approved: totalApproved,
      approvedByBranch: Number(contentTotals[0]?.branchApproved ?? 0),
      target: totalTarget,
      achievement: achievementPercent(totalApproved, totalTarget),
      targetSource: totalTargetSource,
      organizations: organizations.length,
      contentTypes: [...typeCounts.entries()]
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total),
    },
    sources,
    organizations: organizationRows,
    rows: rows.slice(0, 400).map((row) => ({
      ...row,
      status: row.status as ContentStatus,
      source: sourceOfOrganization(row),
      subTheme: row.subTheme ? SUB_THEME_LABELS[row.subTheme as SubTheme] ?? row.subTheme : null,
    })),
    truncated: rows.length > 400,
  };
}
