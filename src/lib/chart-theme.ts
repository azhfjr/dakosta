import type { ContentStatus } from "@/lib/content-status";

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

export const STATUS_CHART_COLOR: Record<ContentStatus, string> = {
  APPROVED: "var(--status-approved)",
  SUBMITTED: "var(--status-submitted)",
  RESUBMITTED: "var(--status-submitted)",
  IN_REVIEW: "var(--status-review)",
  REVISION_REQUIRED: "var(--status-revision)",
  REJECTED: "var(--status-rejected)",
  DRAFT: "var(--status-draft)",
  REVOKED: "var(--ink-muted)",
  ARCHIVED: "var(--ink-muted)",
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
  RESUBMITTED: "#005B9F",
  IN_REVIEW: "#8F560F",
  REVISION_REQUIRED: "#B45309",
  REJECTED: "#B4232A",
  REVOKED: "#4F6779",
  ARCHIVED: "#4F6779",
  DRAFT: "#4F6779",
};
