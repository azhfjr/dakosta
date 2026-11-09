import type { BranchSelection } from "@/lib/filters/branch-selection";
import type { ContentType } from "@/lib/taxonomy";

export const DASHBOARD_CATEGORIES = [
  "FKRTL",
  "FKTP",
  "PEMDA",
  "STAKEHOLDER",
] as const;

export type DashboardCategory = (typeof DASHBOARD_CATEGORIES)[number];

export const DASHBOARD_CATEGORY_LABELS: Record<DashboardCategory, string> = {
  FKRTL: "FKRTL",
  FKTP: "FKTP",
  PEMDA: "Pemda",
  STAKEHOLDER: "Stakeholder",
};

export const DASHBOARD_MAP_POINT_LIMIT = 5000;
export const DASHBOARD_RANKING_LIMIT = 10;
export const DASHBOARD_TREND_MONTHS = 12;

export type DashboardCategoryTotals = Record<DashboardCategory, number>;
export type DashboardCategoryShares = Record<DashboardCategory, number>;

export type DashboardMonthlyPoint = {
  /** `YYYY-MM` in Asia/Jakarta. */
  key: string;
  /** Short month label used on the chart axis (e.g. "Nov"). */
  label: string;
  total: number;
};

export type DashboardMonthlySeries = {
  points: DashboardMonthlyPoint[];
  total: number;
  startKey: string;
  endKey: string;
};

export type DashboardContentTypeKey = ContentType | "UNCLASSIFIED";

export const DASHBOARD_CONTENT_TYPE_LABELS: Record<
  DashboardContentTypeKey,
  string
> = {
  VIDEO: "Video",
  INFOGRAFIS: "Infografis",
  UNCLASSIFIED: "Belum ditentukan",
};

export type DashboardContentTypeSlice = {
  type: DashboardContentTypeKey;
  label: string;
  total: number;
  /** One decimal; slices always sum to exactly 100.0 when total > 0. */
  share: number;
};

export type DashboardTypeTrend = {
  type: DashboardContentTypeKey;
  label: string;
  points: DashboardMonthlyPoint[];
  total: number;
};

export type DashboardThemeKey = "EDUFAST" | "NON_EDUFAST";

export const DASHBOARD_THEME_LABELS: Record<DashboardThemeKey, string> = {
  EDUFAST: "EDUFAST",
  NON_EDUFAST: "Non-EDUFAST",
};

export type DashboardThemeTrend = {
  key: DashboardThemeKey;
  label: string;
  points: DashboardMonthlyPoint[];
  total: number;
};

export type DashboardBranchRow = {
  id: string;
  name: string;
  regionName: string | null;
  categories: DashboardCategoryTotals;
  total: number;
};

export type DashboardSummary = {
  totalApproved: number;
  categoryTotals: DashboardCategoryTotals;
  categoryShares: DashboardCategoryShares;
  branches: DashboardBranchRow[];
  branchCount: number;
  branchesWithContent: number;
  unassignedApproved: number;
  selectionApplicable: boolean;
};

export type DashboardRankingRow = {
  stakeholderId: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
  total: number;
};

export type DashboardInstitutionRow = {
  id: string;
  name: string;
  branchName: string | null;
  total: number;
  categories: DashboardCategoryTotals;
};

export type DashboardInstitutionChart = {
  total: number;
  /** Top institutions; never more than the chart row budget. */
  rows: DashboardInstitutionRow[];
  remaining: {
    count: number;
    total: number;
    categories: DashboardCategoryTotals;
  } | null;
};

export type DashboardMapPoint = {
  id: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
  regionId: string | null;
  regionName: string | null;
  latitude: number;
  longitude: number;
  total: number;
  categories: DashboardCategoryTotals;
};

export type DashboardMapMissingRow = {
  id: string;
  name: string;
  branchName: string | null;
  total: number;
};

export type DashboardMapAggregate = {
  id: string;
  name: string;
  /** Region id for branch aggregates; null for regions. */
  parentId: string | null;
  /** Content-weighted centroid of located institutions; null when none. */
  latitude: number | null;
  longitude: number | null;
  total: number;
  categories: DashboardCategoryTotals;
  institutionCount: number;
  missingInstitutions: number;
};

export type DashboardMap = {
  points: DashboardMapPoint[];
  /** Branch tier; empty when the scope has no branches. */
  branches: DashboardMapAggregate[];
  /** Region tier; empty when the scope has no regional offices. */
  regions: DashboardMapAggregate[];
  missingLocations: DashboardMapMissingRow[];
  /** Largest validated total across all map tiers, for proportional radii. */
  maxTotal: number;
  totals: {
    approved: number;
    mappedApproved: number;
    missingApproved: number;
    institutions: number;
    mappedInstitutions: number;
    missingInstitutions: number;
    truncated: boolean;
  };
};

export type DashboardThemeRow = {
  key: string;
  label: string;
  total: number;
  percentage: number;
};

export type DashboardFiltered = {
  selection: BranchSelection;
  categoryTotals: DashboardCategoryTotals;
  rankings: Record<DashboardCategory, DashboardRankingRow[]>;
  institutionChart: DashboardInstitutionChart;
  edufast: number;
  nonEdufast: number;
  unclassifiedTheme: number;
  nonEdufastThemes: DashboardThemeRow[];
  monthly: DashboardMonthlySeries;
  contentTypes: DashboardContentTypeSlice[];
  typeMonthly: DashboardTypeTrend[];
  themeMonthly: DashboardThemeTrend[];
  map: DashboardMap;
  generatedAt: string;
};
