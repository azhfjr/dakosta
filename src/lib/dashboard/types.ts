import type { BranchSelection } from "@/lib/filters/branch-selection";

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

export type DashboardCategoryTotals = Record<DashboardCategory, number>;

export type DashboardBranchRow = {
  id: string;
  name: string;
  regionName: string | null;
  categories: DashboardCategoryTotals;
  total: number;
};

export type DashboardSummary = {
  totalApproved: number;
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

export type DashboardMapPoint = {
  id: string;
  name: string;
  branchName: string | null;
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

export type DashboardMap = {
  points: DashboardMapPoint[];
  missingLocations: DashboardMapMissingRow[];
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
  edufast: number;
  nonEdufast: number;
  unclassifiedTheme: number;
  nonEdufastThemes: DashboardThemeRow[];
  map: DashboardMap;
  generatedAt: string;
};
