import "server-only";

import { roundOne, monthKeyFor } from "@/lib/kpi/formulas";
import {
  getDashboardAnalytics,
  type AgingBucket,
  type DecisionFunnel,
  type NamedSlice,
  type SlaRow,
  type SourceBreakdownRow,
  type StatusCount,
  type SubmissionVolumePoint,
} from "@/lib/analytics/charts";
import { PENDING_STATUSES } from "@/lib/content-status";
import { resolveThemeCascade } from "@/lib/filters/cascade";
import {
  firstParam,
  parseFilterOrgType,
  parseFilterPage,
  parseFilterSearch,
  type FilterParams,
} from "@/lib/filters/query";
import type { OrgTypeFilter } from "@/lib/filters/org-type";
import { isValidPeriod } from "@/lib/taxonomy";
import { cachedRead, readCacheKey } from "@/lib/read-cache";
import type { SessionUser } from "@/lib/session";
import type { MainTheme, SubTheme } from "@/lib/taxonomy";

export const SLA_QUEUE_PAGE_SIZE = 15;

export type SlaFilters = {
  period: string;
  orgType: OrgTypeFilter | null;
  mainTheme: MainTheme | null;
  subTheme: SubTheme | null;
  search: string;
  page: number;
};

export function parseSlaFilters(params: FilterParams): SlaFilters {
  const rawPeriod = firstParam(params, "period");
  const cascade = resolveThemeCascade(
    firstParam(params, "mainTheme"),
    firstParam(params, "subTheme"),
  );
  return {
    period: rawPeriod && isValidPeriod(rawPeriod) ? rawPeriod : monthKeyFor(),
    orgType: parseFilterOrgType(firstParam(params, "orgType")),
    mainTheme: cascade.mainTheme,
    subTheme: cascade.subTheme,
    search: parseFilterSearch(firstParam(params, "q")),
    page: parseFilterPage(firstParam(params, "page")),
  };
}

/** Shareable query for the SLA filter bar and pagination links. */
export function slaQuery(filters: SlaFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.period) query.period = filters.period;
  if (filters.orgType) query.orgType = filters.orgType;
  if (filters.mainTheme) query.mainTheme = filters.mainTheme;
  if (filters.subTheme) query.subTheme = filters.subTheme;
  if (filters.search) query.q = filters.search;
  if (filters.page > 1) query.page = String(filters.page);
  return query;
}

export type SlaSummary = {
  draft: number;
  pending: number;
  revision: number;
  approved: number;
  submitted: number;
  approvalRate: number | null;
};

export type SlaAnalytics = {
  period: string;
  summary: SlaSummary;
  volume: SubmissionVolumePoint[];
  statusCounts: StatusCount[];
  types: NamedSlice[];
  platforms: NamedSlice[];
  aging: AgingBucket[];
  funnel: DecisionFunnel;
  sources: SourceBreakdownRow[];
  sla: SlaRow[];
  generatedAt: Date;
};

function summarize(statusCounts: StatusCount[]): SlaSummary {
  let draft = 0;
  let pending = 0;
  let revision = 0;
  let approved = 0;
  let submitted = 0;
  for (const row of statusCounts) {
    const total = Number(row.total);
    submitted += total;
    if (row.status === "DRAFT") draft += total;
    if ((PENDING_STATUSES as readonly string[]).includes(row.status)) {
      pending += total;
    }
    if (row.status === "REVISION_REQUIRED") revision += total;
    if (row.status === "APPROVED") approved += total;
  }
  const decided = approved + revision;
  return {
    draft,
    pending,
    revision,
    approved,
    submitted,
    approvalRate: decided > 0 ? roundOne((approved / decided) * 100) : null,
  };
}

/**
 * Operational SLA view: every status, attributed by creation date so in-flight
 * submissions stay visible. Dashboard metrics never use this payload.
 */
export async function getSlaAnalytics(
  user: SessionUser,
  filters: SlaFilters,
): Promise<SlaAnalytics> {
  return cachedRead(
    readCacheKey(user, [
      "sla-analytics",
      filters.period,
      filters.orgType ?? null,
      filters.mainTheme ?? null,
      filters.subTheme ?? null,
    ]),
    async () => {
      const analytics = await getDashboardAnalytics(
        user,
        {
          month: filters.period,
          periodKey: filters.period,
          attribution: "date_created",
          stakeholderId: null,
          subTheme: filters.subTheme,
          orgType: filters.orgType,
          mainTheme: filters.mainTheme,
          sources: [],
        },
        { rankingLevel: null },
      );
      const all = analytics.allContent;
      return {
        period: filters.period,
        summary: summarize(all.statusCounts),
        volume: all.volume,
        statusCounts: all.statusCounts,
        types: all.types,
        platforms: all.platforms,
        aging: all.aging,
        funnel: all.funnel,
        sources: all.sources,
        sla: all.sla,
        generatedAt: new Date(),
      } satisfies SlaAnalytics;
    },
    { ttlMs: 5_000 },
  );
}
