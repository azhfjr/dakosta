import type {
  DashboardMapAggregate,
  DashboardMapPoint,
} from "@/lib/dashboard/types";
import type { DashboardVariant } from "@/lib/dashboard/variant";

export type DashboardMapTier = "region" | "branch" | "institution";

export type MapTierWindow = {
  tier: DashboardMapTier;
  minZoom: number;
  maxZoom: number;
};

export const MAP_MAX_ZOOM = 12;
export const NATIONAL_REGION_MAX_ZOOM = 6.5;
export const NATIONAL_BRANCH_MAX_ZOOM = 9;
export const REGIONAL_BRANCH_MAX_ZOOM = 8.5;

export const MAP_TIER_LABELS: Record<DashboardMapTier, string> = {
  region: "Wilayah",
  branch: "Cabang",
  institution: "Institusi",
};

export const MAP_AGGREGATE_RADIUS = { min: 14, max: 46 } as const;
export const MAP_INSTITUTION_RADIUS = { min: 5, max: 18 } as const;

/**
 * Zoom bands per role. National zooms out to regions, then branches, then
 * institutions; the other roles start one tier lower because their scope is
 * already narrower.
 */
export function mapTierWindows(
  variant: DashboardVariant,
): readonly MapTierWindow[] {
  switch (variant) {
    case "national":
      return [
        { tier: "region", minZoom: 0, maxZoom: NATIONAL_REGION_MAX_ZOOM },
        {
          tier: "branch",
          minZoom: NATIONAL_REGION_MAX_ZOOM,
          maxZoom: NATIONAL_BRANCH_MAX_ZOOM,
        },
        {
          tier: "institution",
          minZoom: NATIONAL_BRANCH_MAX_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
        },
      ];
    case "regional":
      return [
        { tier: "branch", minZoom: 0, maxZoom: REGIONAL_BRANCH_MAX_ZOOM },
        {
          tier: "institution",
          minZoom: REGIONAL_BRANCH_MAX_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
        },
      ];
    case "branch":
      return [{ tier: "institution", minZoom: 0, maxZoom: MAP_MAX_ZOOM }];
    case "stakeholder":
      return [];
  }
}

export function mapTierForZoom(
  variant: DashboardVariant,
  zoom: number,
): DashboardMapTier | null {
  const windows = mapTierWindows(variant);
  if (windows.length === 0) return null;
  return (
    windows.find((window) => zoom >= window.minZoom && zoom < window.maxZoom)
      ?.tier ?? windows[windows.length - 1]!.tier
  );
}

/** Bubble radius grows with the square root of validated content. */
export function scaleBubbleRadius(
  total: number,
  maxTotal: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(total) || total <= 0) return min;
  const ceiling =
    Number.isFinite(maxTotal) && maxTotal > 0 ? maxTotal : Math.max(total, 1);
  const ratio = Math.sqrt(Math.min(total, ceiling) / ceiling);
  return Math.round(min + (max - min) * ratio);
}

export function aggregateRadius(total: number, maxTotal: number): number {
  return scaleBubbleRadius(
    total,
    maxTotal,
    MAP_AGGREGATE_RADIUS.min,
    MAP_AGGREGATE_RADIUS.max,
  );
}

export function institutionRadius(total: number, maxTotal: number): number {
  return scaleBubbleRadius(
    total,
    maxTotal,
    MAP_INSTITUTION_RADIUS.min,
    MAP_INSTITUTION_RADIUS.max,
  );
}

export type MapAggregateFeatureProperties = {
  id: string;
  name: string;
  tier: "region" | "branch";
  total: number;
  radius: number;
  institutionCount: number;
  missingInstitutions: number;
};

export type MapInstitutionFeatureProperties = {
  id: string;
  name: string;
  tier: "institution";
  total: number;
  radius: number;
  branchName: string;
  regionName: string;
};

export type MapPointFeature<Properties extends { tier: DashboardMapTier }> = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Properties;
};

export type MapFeatureCollection<
  Properties extends { tier: DashboardMapTier },
> = {
  type: "FeatureCollection";
  features: MapPointFeature<Properties>[];
};

export function aggregateFeatureCollection(
  rows: readonly DashboardMapAggregate[],
  tier: "region" | "branch",
  maxTotal: number,
): MapFeatureCollection<MapAggregateFeatureProperties> {
  const features: MapPointFeature<MapAggregateFeatureProperties>[] = [];
  for (const row of rows) {
    if (row.latitude == null || row.longitude == null) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
      properties: {
        id: row.id,
        name: row.name,
        tier,
        total: row.total,
        radius: aggregateRadius(row.total, maxTotal),
        institutionCount: row.institutionCount,
        missingInstitutions: row.missingInstitutions,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function institutionFeatureCollection(
  points: readonly DashboardMapPoint[],
  maxTotal: number,
): MapFeatureCollection<MapInstitutionFeatureProperties> {
  const features: MapPointFeature<MapInstitutionFeatureProperties>[] =
    points.map((point) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.longitude, point.latitude],
      },
      properties: {
        id: point.id,
        name: point.name,
        tier: "institution",
        total: point.total,
        radius: institutionRadius(point.total, maxTotal),
        branchName: point.branchName ?? "",
        regionName: point.regionName ?? "",
      },
    }));
  return { type: "FeatureCollection", features };
}

export type CentroidSource = {
  latitude: number | null;
  longitude: number | null;
  total: number;
};

/**
 * Content-weighted centroid of the located institutions so a branch with many
 * validated items lands where its contributing institutions actually are.
 */
export function weightedCentroid(
  rows: readonly CentroidSource[],
): { latitude: number; longitude: number } | null {
  let weight = 0;
  let latitude = 0;
  let longitude = 0;
  for (const row of rows) {
    if (row.latitude == null || row.longitude == null) continue;
    if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) {
      continue;
    }
    if (row.total <= 0) continue;
    weight += row.total;
    latitude += row.latitude * row.total;
    longitude += row.longitude * row.total;
  }
  if (weight <= 0) return null;
  return { latitude: latitude / weight, longitude: longitude / weight };
}
