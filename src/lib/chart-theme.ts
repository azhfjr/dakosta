import type { ContentStatus } from "@/lib/content-status";
import type {
  DashboardCategory,
  DashboardContentTypeKey,
  DashboardThemeKey,
} from "@/lib/dashboard/types";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const CHART_GRID = "var(--border)";
export const CHART_AXIS = "var(--ink-muted)";
export const CHART_TOOLTIP_LABEL = "var(--ink)";

export const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  boxShadow: "0 8px 24px rgba(16, 42, 67, 0.08)",
  fontSize: 12,
} as const;

/** Shared category palette so charts, rankings, and map chips never diverge. */
export const CATEGORY_CHART_COLORS: Record<DashboardCategory, string> = {
  FKRTL: "var(--chart-1)",
  FKTP: "var(--chart-2)",
  PEMDA: "var(--chart-3)",
  STAKEHOLDER: "var(--chart-4)",
};

/** Literal copies for MapLibre, which cannot resolve CSS custom properties. */
export const CATEGORY_MAP_COLORS: Record<DashboardCategory, string> = {
  FKRTL: "#00A651",
  FKTP: "#00857C",
  PEMDA: "#005B9F",
  STAKEHOLDER: "#B45309",
};

/** Content-type palette shared by the pie, trend charts, and legends. */
export const CONTENT_TYPE_CHART_COLORS: Record<
  DashboardContentTypeKey,
  string
> = {
  VIDEO: "var(--chart-1)",
  INFOGRAFIS: "var(--chart-2)",
  UNCLASSIFIED: "var(--chart-5)",
};

/** Literal copies for the PDF renderer and other non-CSS surfaces. */
export const CONTENT_TYPE_MAP_COLORS: Record<DashboardContentTypeKey, string> =
  {
    VIDEO: "#00A651",
    INFOGRAFIS: "#005B9F",
    UNCLASSIFIED: "#64748B",
  };

/** Dashboard EDUFAST split; distinct from legacy submission sub-themes. */
export const DASHBOARD_THEME_CHART_COLORS: Record<DashboardThemeKey, string> = {
  EDUFAST: "var(--chart-1)",
  NON_EDUFAST: "var(--chart-3)",
};

/** Single-series monthly trend color. */
export const MONTHLY_TREND_COLOR = "var(--chart-1)";

export const THEME_CHART_COLORS: Record<string, string> = {
  MOBILE_JKN: "var(--chart-1)",
  TESTIMONI_PESERTA: "var(--chart-2)",
  ALUR_BEROBAT: "var(--chart-3)",
  EDUKATIF_PERSUASIF: "var(--chart-4)",
  KORPORAT: "var(--chart-5)",
  INFORMASI: "#7c3aed",
  TANPA_SUB_TEMA: "#0e7490",
};

/** Literal palette for PDF output, which cannot resolve CSS variables. */
export const CHART_MAP_COLORS = [
  "#00a651",
  "#00857c",
  "#005b9f",
  "#b45309",
  "#64748b",
] as const;

export const THEME_MAP_COLORS: Record<string, string> = {
  MOBILE_JKN: CHART_MAP_COLORS[0],
  TESTIMONI_PESERTA: CHART_MAP_COLORS[1],
  ALUR_BEROBAT: CHART_MAP_COLORS[2],
  EDUKATIF_PERSUASIF: CHART_MAP_COLORS[3],
  KORPORAT: CHART_MAP_COLORS[4],
  INFORMASI: "#7c3aed",
  TANPA_SUB_TEMA: "#0e7490",
};

export function themeMapColor(key: string, fallbackIndex = 0): string {
  return (
    THEME_MAP_COLORS[key] ??
    CHART_MAP_COLORS[fallbackIndex % CHART_MAP_COLORS.length]!
  );
}

export function themeChartColor(key: string, fallbackIndex = 0): string {
  return (
    THEME_CHART_COLORS[key] ??
    CHART_COLORS[fallbackIndex % CHART_COLORS.length]!
  );
}

export const STATUS_CHART_COLOR: Record<ContentStatus, string> = {
  APPROVED: "var(--status-approved)",
  SUBMITTED: "var(--status-submitted)",
  REVISION_REQUIRED: "var(--status-revision)",
  DRAFT: "var(--status-draft)",
};

/**
 * MapLibre paint properties cannot resolve CSS custom properties, so the map
 * keeps a literal copy of the same design tokens used by the charts.
 */
export const MAP_BRAND = {
  green: "#00A651",
  greenDark: "#006B3C",
  teal: "#00857C",
  blue: "#005B9F",
  ink: "#122A38",
  surface: "#FFFFFF",
} as const;

export const MAP_STATUS_COLOR: Record<string, string> = {
  APPROVED: "#0F7A46",
  SUBMITTED: "#005B9F",
  REVISION_REQUIRED: "#B45309",
  DRAFT: "#4F6779",
};
