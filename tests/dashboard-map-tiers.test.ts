import { describe, expect, it } from "vitest";

import {
  MAP_AGGREGATE_RADIUS,
  MAP_INSTITUTION_RADIUS,
  aggregateFeatureCollection,
  aggregateRadius,
  institutionFeatureCollection,
  institutionRadius,
  mapTierForZoom,
  mapTierWindows,
  scaleBubbleRadius,
  weightedCentroid,
} from "@/lib/dashboard/map-tiers";
import type {
  DashboardMapAggregate,
  DashboardMapPoint,
} from "@/lib/dashboard/types";

function aggregate(
  overrides: Partial<DashboardMapAggregate> = {},
): DashboardMapAggregate {
  return {
    id: "branch-1",
    name: "Cabang 1",
    parentId: "region-1",
    latitude: -6.2,
    longitude: 106.8,
    total: 10,
    categories: { FKRTL: 4, FKTP: 3, PEMDA: 2, STAKEHOLDER: 1 },
    institutionCount: 3,
    missingInstitutions: 1,
    ...overrides,
  };
}

function point(overrides: Partial<DashboardMapPoint> = {}): DashboardMapPoint {
  return {
    id: "stakeholder-1",
    name: "Institusi 1",
    branchId: "branch-1",
    branchName: "Cabang 1",
    regionId: "region-1",
    regionName: "Wilayah 1",
    latitude: -6.2,
    longitude: 106.8,
    total: 5,
    categories: { FKRTL: 2, FKTP: 1, PEMDA: 1, STAKEHOLDER: 1 },
    ...overrides,
  };
}

describe("mapTierWindows", () => {
  it("gives national three tiers and narrower roles fewer", () => {
    expect(mapTierWindows("national").map((window) => window.tier)).toEqual([
      "region",
      "branch",
      "institution",
    ]);
    expect(mapTierWindows("regional").map((window) => window.tier)).toEqual([
      "branch",
      "institution",
    ]);
    expect(mapTierWindows("branch").map((window) => window.tier)).toEqual([
      "institution",
    ]);
    expect(mapTierWindows("stakeholder")).toEqual([]);
  });

  it("switches tiers exactly at the configured zoom boundaries", () => {
    expect(mapTierForZoom("national", 5)).toBe("region");
    expect(mapTierForZoom("national", 6.49)).toBe("region");
    expect(mapTierForZoom("national", 6.5)).toBe("branch");
    expect(mapTierForZoom("national", 8.99)).toBe("branch");
    expect(mapTierForZoom("national", 9)).toBe("institution");
    expect(mapTierForZoom("national", 14)).toBe("institution");

    expect(mapTierForZoom("regional", 8.49)).toBe("branch");
    expect(mapTierForZoom("regional", 8.5)).toBe("institution");
    expect(mapTierForZoom("branch", 2)).toBe("institution");
    expect(mapTierForZoom("stakeholder", 10)).toBeNull();
  });
});

describe("bubble radius", () => {
  it("scales with the square root of validated content", () => {
    expect(aggregateRadius(0, 100)).toBe(MAP_AGGREGATE_RADIUS.min);
    expect(aggregateRadius(100, 100)).toBe(MAP_AGGREGATE_RADIUS.max);
    expect(aggregateRadius(25, 100)).toBe(
      Math.round(
        MAP_AGGREGATE_RADIUS.min +
          (MAP_AGGREGATE_RADIUS.max - MAP_AGGREGATE_RADIUS.min) * 0.5,
      ),
    );
    expect(institutionRadius(0, 100)).toBe(MAP_INSTITUTION_RADIUS.min);
    expect(institutionRadius(100, 100)).toBe(MAP_INSTITUTION_RADIUS.max);
  });

  it("is monotonic and clamps invalid input", () => {
    let previous = -Infinity;
    for (const total of [0, 1, 5, 20, 60, 100]) {
      const radius = scaleBubbleRadius(total, 100, 10, 40);
      expect(radius).toBeGreaterThanOrEqual(previous);
      previous = radius;
    }
    expect(scaleBubbleRadius(Number.NaN, 100, 10, 40)).toBe(10);
    expect(scaleBubbleRadius(50, 0, 10, 40)).toBe(40);
  });
});

describe("weightedCentroid", () => {
  it("weights located institutions by validated content", () => {
    const centroid = weightedCentroid([
      { latitude: -6, longitude: 106, total: 1 },
      { latitude: -8, longitude: 108, total: 3 },
      { latitude: null, longitude: null, total: 100 },
    ]);
    expect(centroid).toEqual({ latitude: -7.5, longitude: 107.5 });
  });

  it("returns null when no institution is located", () => {
    expect(
      weightedCentroid([{ latitude: null, longitude: null, total: 5 }]),
    ).toBeNull();
    expect(weightedCentroid([])).toBeNull();
  });
});

describe("feature collections", () => {
  it("drops aggregates without a centroid but keeps their computed totals", () => {
    const collection = aggregateFeatureCollection(
      [
        aggregate(),
        aggregate({ id: "branch-2", latitude: null, longitude: null }),
      ],
      "branch",
      20,
    );
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]!.geometry.coordinates).toEqual([106.8, -6.2]);
    expect(collection.features[0]!.properties).toMatchObject({
      id: "branch-1",
      tier: "branch",
      total: 10,
      institutionCount: 3,
      missingInstitutions: 1,
      radius: aggregateRadius(10, 20),
    });
  });

  it("sizes institution features by validated content", () => {
    const collection = institutionFeatureCollection(
      [point(), point({ id: "stakeholder-2", total: 10, latitude: -7 })],
      10,
    );
    expect(collection.features).toHaveLength(2);
    expect(collection.features[0]!.properties.radius).toBe(
      institutionRadius(5, 10),
    );
    expect(collection.features[1]!.properties.radius).toBe(
      MAP_INSTITUTION_RADIUS.max,
    );
    expect(collection.features[1]!.properties).toMatchObject({
      tier: "institution",
      branchName: "Cabang 1",
      regionName: "Wilayah 1",
    });
  });
});
