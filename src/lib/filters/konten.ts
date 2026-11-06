import type {
  AnalyticsContentFilters,
  AnalyticsSort,
} from "@/lib/analytics/content-table";
import type { OrgSource } from "@/lib/analytics/org-source";
import {
  firstParam,
  parseFilterContentType,
  parseFilterPage,
  parseFilterPeriod,
  parseFilterSearch,
  parseFilterSort,
  parseFilterSource,
  parseFilterSubTheme,
  parseFilterUuid,
  type FilterParams,
} from "@/lib/filters/query";
import type { ContentType, SubTheme } from "@/lib/taxonomy";

export const KONTEN_SORTS = [
  "approved_recent",
  "approved_oldest",
  "title",
  "organization",
] as const satisfies readonly AnalyticsSort[];

export type KontenSort = (typeof KONTEN_SORTS)[number];

export type KontenFilters = {
  period: string;
  source: OrgSource | null;
  subTheme: SubTheme | null;
  contentType: ContentType | null;
  stakeholderId: string | null;
  sort: KontenSort;
  search: string;
  page: number;
};

export const KONTEN_SORT_LABELS: Record<KontenSort, string> = {
  approved_recent: "Terbaru disetujui",
  approved_oldest: "Terlama disetujui",
  title: "Judul A–Z",
  organization: "Organisasi A–Z",
};

/**
 * The Konten pages are approved-only by design; `status` is forced here so a
 * crafted URL cannot widen the table beyond validated content.
 */
export function parseKontenFilters(params: FilterParams): KontenFilters {
  return {
    period: parseFilterPeriod(params),
    source: parseFilterSource(firstParam(params, "source")),
    subTheme: parseFilterSubTheme(firstParam(params, "subTheme")),
    contentType: parseFilterContentType(firstParam(params, "type")),
    stakeholderId: parseFilterUuid(firstParam(params, "stakeholderId")),
    sort: parseFilterSort(
      firstParam(params, "sort"),
      KONTEN_SORTS,
      "approved_recent",
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
    periodBasis: "approved",
    status: "APPROVED",
    sources: filters.source ? [filters.source] : [],
    stakeholderId: filters.stakeholderId,
    subTheme: filters.subTheme,
    contentType: filters.contentType,
    decidedBy: "ANY",
    sort: filters.sort,
    search: filters.search,
    page: filters.page,
  };
}

/** Canonical shareable query for the Konten pages. */
export function kontenQuery(filters: KontenFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.period !== "ALL") query.period = filters.period;
  if (filters.source) query.source = filters.source;
  if (filters.subTheme) query.subTheme = filters.subTheme;
  if (filters.contentType) query.type = filters.contentType;
  if (filters.stakeholderId) query.stakeholderId = filters.stakeholderId;
  if (filters.sort !== "approved_recent") query.sort = filters.sort;
  if (filters.search) query.q = filters.search;
  if (filters.page > 1) query.page = String(filters.page);
  return query;
}
