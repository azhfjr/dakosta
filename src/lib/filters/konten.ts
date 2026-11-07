import type {
  AnalyticsContentFilters,
  AnalyticsSort,
} from "@/lib/analytics/content-table";
import type { OrgSource } from "@/lib/analytics/org-source";
import type { OrgTypeFilter } from "@/lib/filters/org-type";
import {
  firstParam,
  parseFilterContentType,
  parseFilterDate,
  parseFilterMainTheme,
  parseFilterOrgType,
  parseFilterPage,
  parseFilterPeriod,
  parseFilterPlatform,
  parseFilterSearch,
  parseFilterSort,
  parseFilterSource,
  parseFilterStatus,
  parseFilterSubTheme,
  parseFilterUuid,
  type FilterParams,
} from "@/lib/filters/query";
import type { ContentStatus } from "@/lib/content-status";
import type { ContentType, MainTheme, SubTheme } from "@/lib/taxonomy";

/** `all` keeps every status; `approved` forces the canonical approved subset. */
export type KontenMode = "all" | "approved";

export const KONTEN_SORTS = [
  "recent",
  "oldest",
  "title",
  "decision",
  "status",
  "approved_recent",
  "approved_oldest",
  "organization",
] as const satisfies readonly AnalyticsSort[];

export type KontenSort = (typeof KONTEN_SORTS)[number];

export type KontenFilters = {
  mode: KontenMode;
  period: string;
  status: ContentStatus | "ALL";
  source: OrgSource | null;
  orgType: OrgTypeFilter | null;
  mainTheme: MainTheme | null;
  subTheme: SubTheme | null;
  contentType: ContentType | null;
  platform: string | null;
  stakeholderId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  sort: KontenSort;
  search: string;
  page: number;
};

export const KONTEN_SORT_LABELS: Record<KontenSort, string> = {
  recent: "Terbaru dibuat",
  oldest: "Terlama dibuat",
  title: "Judul A–Z",
  decision: "Keputusan terbaru",
  status: "Status",
  approved_recent: "Terbaru disetujui",
  approved_oldest: "Terlama disetujui",
  organization: "Organisasi A–Z",
};

export function defaultKontenSort(mode: KontenMode): KontenSort {
  return mode === "approved" ? "approved_recent" : "recent";
}

/**
 * Detail Konten is all-status by default; the dashboard-approved view passes
 * `mode: "approved"` so a crafted URL cannot widen it beyond validated content.
 */
export function parseKontenFilters(
  params: FilterParams,
  mode: KontenMode = "approved",
): KontenFilters {
  return {
    mode,
    period: parseFilterPeriod(params),
    status:
      mode === "approved"
        ? "APPROVED"
        : parseFilterStatus(firstParam(params, "status")),
    source: parseFilterSource(firstParam(params, "source")),
    orgType: parseFilterOrgType(firstParam(params, "orgType")),
    mainTheme: parseFilterMainTheme(firstParam(params, "mainTheme")),
    subTheme: parseFilterSubTheme(firstParam(params, "subTheme")),
    contentType: parseFilterContentType(firstParam(params, "type")),
    platform: parseFilterPlatform(firstParam(params, "platform")),
    stakeholderId: parseFilterUuid(firstParam(params, "stakeholderId")),
    dateFrom: parseFilterDate(firstParam(params, "from")),
    dateTo: parseFilterDate(firstParam(params, "to")),
    sort: parseFilterSort(
      firstParam(params, "sort"),
      KONTEN_SORTS,
      defaultKontenSort(mode),
    ),
    search: parseFilterSearch(firstParam(params, "q")),
    page: parseFilterPage(firstParam(params, "page")),
  };
}

export function toAnalyticsFilters(
  filters: KontenFilters,
): AnalyticsContentFilters {
  return {
    period: filters.period,
    periodBasis: filters.mode === "approved" ? "approved" : "created",
    status: filters.status,
    scope: filters.mode,
    sources: filters.source ? [filters.source] : [],
    stakeholderId: filters.stakeholderId,
    orgType: filters.orgType,
    mainTheme: filters.mainTheme,
    subTheme: filters.subTheme,
    contentType: filters.contentType,
    platform: filters.platform,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    decidedBy: "ANY",
    sort: filters.sort,
    search: filters.search,
    page: filters.page,
  };
}

/** Canonical shareable query for the Detail Konten pages. */
export function kontenQuery(filters: KontenFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.mode === "all") query.mode = "all";
  if (filters.period !== "ALL") query.period = filters.period;
  if (filters.status !== "ALL" && filters.mode !== "approved") {
    query.status = filters.status;
  }
  if (filters.source) query.source = filters.source;
  if (filters.orgType) query.orgType = filters.orgType;
  if (filters.mainTheme) query.mainTheme = filters.mainTheme;
  if (filters.subTheme) query.subTheme = filters.subTheme;
  if (filters.contentType) query.type = filters.contentType;
  if (filters.platform) query.platform = filters.platform;
  if (filters.stakeholderId) query.stakeholderId = filters.stakeholderId;
  if (filters.dateFrom) query.from = filters.dateFrom;
  if (filters.dateTo) query.to = filters.dateTo;
  if (filters.sort !== defaultKontenSort(filters.mode))
    query.sort = filters.sort;
  if (filters.search) query.q = filters.search;
  if (filters.page > 1) query.page = String(filters.page);
  return query;
}

/** CSV/PDF exports must mirror the active filters and never a single page. */
export function kontenExportQuery(
  filters: KontenFilters,
  scopePath?: string,
): string {
  const query = new URLSearchParams(kontenQuery(filters));
  query.delete("page");
  query.delete("sort");
  if (scopePath) query.set("scope", scopePath);
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}
