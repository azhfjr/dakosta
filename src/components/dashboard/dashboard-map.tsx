"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import type { FeatureCollection, Point as GeoPoint } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

import { Button } from "@/components/ui/button";
import { CATEGORY_MAP_COLORS, MAP_BRAND } from "@/lib/chart-theme";
import {
  DASHBOARD_CATEGORIES,
  DASHBOARD_CATEGORY_LABELS,
  type DashboardCategory,
  type DashboardMap,
  type DashboardMapAggregate,
  type DashboardMapPoint,
} from "@/lib/dashboard/types";
import type { DashboardVariant } from "@/lib/dashboard/variant";
import {
  MAP_TIER_LABELS,
  aggregateFeatureCollection,
  institutionFeatureCollection,
  mapTierForZoom,
  mapTierWindows,
  type DashboardMapTier,
} from "@/lib/dashboard/map-tiers";
import { formatNumberId } from "@/lib/dates";

const BANDUNG = { latitude: -6.9175, longitude: 107.6191 };
const SOURCE_REGIONS = "dashboard-map-regions";
const SOURCE_BRANCHES = "dashboard-map-branches";
const SOURCE_POINTS = "dashboard-map-institutions";

type Status = "loading" | "ready" | "failed";

type AggregateProperties = {
  id: string;
  name: string;
  tier: "region" | "branch";
  total: number;
  radius: number;
  institutionCount: number;
  missingInstitutions: number;
};

type InstitutionProperties = {
  id: string;
  name: string;
  tier: "institution";
  total: number;
  radius: number;
  branchName: string;
  regionName: string;
};

function aggregateCollection(
  rows: readonly DashboardMapAggregate[],
  tier: "region" | "branch",
  maxTotal: number,
): FeatureCollection<GeoPoint, AggregateProperties> {
  const base = aggregateFeatureCollection(rows, tier, maxTotal);
  return {
    type: "FeatureCollection",
    features: base.features.map((feature) => ({
      type: "Feature",
      geometry: feature.geometry,
      properties: feature.properties,
    })),
  } as FeatureCollection<GeoPoint, AggregateProperties>;
}

function institutionCollection(
  points: readonly DashboardMapPoint[],
  maxTotal: number,
): FeatureCollection<GeoPoint, InstitutionProperties> {
  const base = institutionFeatureCollection(points, maxTotal);
  return {
    type: "FeatureCollection",
    features: base.features.map((feature) => ({
      type: "Feature",
      geometry: feature.geometry,
      properties: feature.properties,
    })),
  } as FeatureCollection<GeoPoint, InstitutionProperties>;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function chip(category: DashboardCategory, value: number): HTMLElement {
  const row = element("li", "flex items-center justify-between gap-4 text-xs");
  const left = element(
    "span",
    "inline-flex items-center gap-1.5 text-ink-muted",
  );
  const dot = element("span", "size-2 rounded-full");
  dot.style.backgroundColor = CATEGORY_MAP_COLORS[category];
  left.append(
    dot,
    document.createTextNode(DASHBOARD_CATEGORY_LABELS[category]),
  );
  const count = element(
    "span",
    value > 0
      ? "font-semibold text-foreground tabular"
      : "text-ink-muted tabular",
    formatNumberId(value),
  );
  row.append(left, count);
  return row;
}

function categoryList(
  categories: Partial<Record<DashboardCategory, number>> | undefined,
): HTMLElement {
  const list = element("ul", "mt-2 space-y-1");
  for (const category of DASHBOARD_CATEGORIES) {
    list.append(chip(category, categories?.[category] ?? 0));
  }
  return list;
}

function institutionPopup(
  properties: Record<string, unknown>,
  point: DashboardMapPoint | undefined,
): HTMLElement {
  const root = element("div", "min-w-[190px] space-y-1");
  root.append(
    element(
      "p",
      "text-sm font-semibold text-foreground",
      String(properties.name ?? "Tanpa nama"),
    ),
  );
  const branchName = point?.branchName ?? String(properties.branchName ?? "");
  if (branchName) {
    root.append(element("p", "text-xs text-ink-muted", branchName));
  }
  root.append(
    element(
      "p",
      "text-xs text-ink-muted",
      `${formatNumberId(Number(properties.total ?? 0))} konten tervalidasi`,
    ),
  );
  root.append(categoryList(point?.categories));
  return root;
}

function aggregatePopup(
  properties: Record<string, unknown>,
  row: DashboardMapAggregate | undefined,
  onZoom: () => void,
): HTMLElement {
  const root = element("div", "min-w-[210px] space-y-1");
  root.append(
    element(
      "p",
      "text-sm font-semibold text-foreground",
      String(properties.name ?? "Tanpa nama"),
    ),
  );
  root.append(
    element(
      "p",
      "text-xs text-ink-muted",
      `${formatNumberId(Number(properties.total ?? 0))} konten tervalidasi`,
    ),
  );
  root.append(
    element(
      "p",
      "text-xs text-ink-muted",
      `${formatNumberId(Number(properties.institutionCount ?? 0))} institusi berlokasi`,
    ),
  );
  const missing = Number(properties.missingInstitutions ?? 0);
  if (missing > 0) {
    root.append(
      element(
        "p",
        "text-xs text-status-review",
        `${formatNumberId(missing)} institusi belum memiliki koordinat (tetap dihitung)`,
      ),
    );
  }
  root.append(categoryList(row?.categories));
  const zoomButton = element(
    "button",
    "mt-2 inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-brand-blue-700 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    "Klik untuk memperbesar",
  );
  zoomButton.type = "button";
  zoomButton.addEventListener("click", onZoom);
  root.append(zoomButton);
  return root;
}

function boundsFrom(
  maplibregl: typeof import("maplibre-gl"),
  coordinates: Array<[number, number]>,
) {
  if (coordinates.length === 0) return null;
  const bounds = new maplibregl.LngLatBounds();
  for (const coordinate of coordinates) bounds.extend(coordinate);
  return bounds;
}

function initialCoordinates(
  map: DashboardMap,
  tier: DashboardMapTier,
): Array<[number, number]> {
  const rows: Array<{ longitude: number | null; latitude: number | null }> =
    tier === "region"
      ? map.regions
      : tier === "branch"
        ? map.branches
        : map.points;
  const coordinates: Array<[number, number]> = [];
  for (const row of rows) {
    if (row.longitude == null || row.latitude == null) continue;
    coordinates.push([row.longitude, row.latitude]);
  }
  if (coordinates.length === 0) {
    for (const point of map.points) {
      coordinates.push([point.longitude, point.latitude]);
    }
  }
  return coordinates;
}

function childCoordinates(
  map: DashboardMap,
  row: DashboardMapAggregate,
): { coordinates: Array<[number, number]>; maxZoom: number } {
  const branches = map.branches.filter(
    (branch) =>
      branch.parentId === row.id &&
      branch.latitude != null &&
      branch.longitude != null,
  );
  if (branches.length > 0) {
    return {
      coordinates: branches.map(
        (branch) => [branch.longitude, branch.latitude] as [number, number],
      ),
      maxZoom: 8.4,
    };
  }
  const points = map.points.filter(
    (point) => point.branchId === row.id || point.regionId === row.id,
  );
  return {
    coordinates: points.map(
      (point) => [point.longitude, point.latitude] as [number, number],
    ),
    maxZoom: 12,
  };
}

export function DashboardMapSection({
  map,
  styleUrl,
  variant,
}: {
  map: DashboardMap;
  styleUrl: string;
  variant: DashboardVariant;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tier, setTier] = useState<DashboardMapTier | null>(() =>
    mapTierForZoom(variant, 0),
  );
  const [status, setStatus] = useState<Status>(
    map.points.length === 0 ? "ready" : "loading",
  );

  useEffect(() => {
    if (map.points.length === 0) return;
    const tierWindows = mapTierWindows(variant);
    if (tierWindows.length === 0) return;
    const containerEl = containerRef.current;
    if (!containerEl) return;
    let disposed = false;
    let started = false;
    let observer: IntersectionObserver | null = null;
    let localMap: MapLibreMap | null = null;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;

    function begin() {
      if (started || disposed) return;
      started = true;
      observer?.disconnect();
      void start();
    }

    async function start() {
      try {
        const maplibregl = await import("maplibre-gl");
        if (disposed || !containerRef.current) return;
        maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

        const instance = new maplibregl.Map({
          container: containerRef.current,
          style: styleUrl,
          center: [BANDUNG.longitude, BANDUNG.latitude],
          zoom: 9,
          minZoom: 3,
          maxZoom: 12,
          attributionControl: { compact: true },
        });
        localMap = instance;

        instance.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-right",
        );
        instance.addControl(
          new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
          "bottom-left",
        );

        const windows = new Map(
          tierWindows.map((window) => [window.tier, window]),
        );
        const regionWindow = windows.get("region");
        const branchWindow = windows.get("branch");
        const institutionWindow = windows.get("institution");
        const radiusScale = window.innerWidth < 640 ? 0.72 : 1;
        const radiusExpression = (radiusScale === 1
          ? ["get", "radius"]
          : [
              "*",
              ["get", "radius"],
              radiusScale,
            ]) as unknown as ExpressionSpecification;

        let loaded = false;
        instance.on("load", () => {
          loaded = true;
          if (disposed) return;
          setStatus("ready");

          const zoomTo = (
            coordinates: Array<[number, number]>,
            maxZoom: number,
            fallback: [number, number],
          ) => {
            const bounds = boundsFrom(maplibregl, coordinates);
            if (bounds) {
              instance.fitBounds(bounds, {
                padding: { top: 50, right: 50, bottom: 50, left: 50 },
                maxZoom,
                duration: 0,
              });
              return;
            }
            instance.easeTo({
              center: fallback,
              zoom: Math.min(instance.getZoom() + 1.5, 12),
              duration: 0,
            });
          };

          const bindAggregate = (
            layerId: string,
            rows: DashboardMapAggregate[],
          ) => {
            if (!instance.getLayer(layerId)) return;
            instance.on("click", layerId, (event) => {
              const feature = instance.queryRenderedFeatures(event.point, {
                layers: [layerId],
              })[0];
              if (!feature) return;
              const properties = (feature.properties ?? {}) as Record<
                string,
                unknown
              >;
              const row = rows.find(
                (item) => item.id === String(properties.id ?? ""),
              );
              const popup = new maplibregl.Popup({
                offset: 14,
                maxWidth: "270px",
              })
                .setLngLat(event.lngLat)
                .setDOMContent(
                  aggregatePopup(properties, row, () => {
                    if (!row) return;
                    const { coordinates, maxZoom } = childCoordinates(map, row);
                    popup.remove();
                    zoomTo(coordinates, maxZoom, [
                      row.longitude ?? BANDUNG.longitude,
                      row.latitude ?? BANDUNG.latitude,
                    ]);
                  }),
                )
                .addTo(instance);
            });
            instance.on("mouseenter", layerId, () => {
              instance.getCanvas().style.cursor = "pointer";
            });
            instance.on("mouseleave", layerId, () => {
              instance.getCanvas().style.cursor = "";
            });
          };

          if (regionWindow && map.regions.length > 0) {
            instance.addSource(SOURCE_REGIONS, {
              type: "geojson",
              data: aggregateCollection(map.regions, "region", map.maxTotal),
            });
            instance.addLayer({
              id: "region-points",
              type: "circle",
              source: SOURCE_REGIONS,
              minzoom: regionWindow.minZoom,
              maxzoom: regionWindow.maxZoom,
              paint: {
                "circle-color": MAP_BRAND.greenDark,
                "circle-opacity": 0.88,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
                "circle-radius": radiusExpression,
              },
            });
            instance.addLayer({
              id: "region-labels",
              type: "symbol",
              source: SOURCE_REGIONS,
              minzoom: regionWindow.minZoom,
              maxzoom: regionWindow.maxZoom,
              layout: {
                "text-field": [
                  "concat",
                  ["get", "name"],
                  "\n",
                  ["number-format", ["get", "total"], { locale: "id-ID" }],
                ],
                "text-size": 11,
                "text-font": ["Noto Sans Regular"],
                "text-line-height": 1.1,
                "text-max-width": 9,
                "text-variable-anchor": ["top", "bottom", "left", "right"],
                "text-radial-offset": 1.6,
                "text-justify": "auto",
                "symbol-sort-key": ["*", ["get", "total"], -1],
              },
              paint: {
                "text-color": MAP_BRAND.ink,
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.4,
              },
            });
            bindAggregate("region-points", map.regions);
          }

          if (branchWindow && map.branches.length > 0) {
            instance.addSource(SOURCE_BRANCHES, {
              type: "geojson",
              data: aggregateCollection(map.branches, "branch", map.maxTotal),
            });
            instance.addLayer({
              id: "branch-points",
              type: "circle",
              source: SOURCE_BRANCHES,
              minzoom: branchWindow.minZoom,
              maxzoom: branchWindow.maxZoom,
              paint: {
                "circle-color": MAP_BRAND.blue,
                "circle-opacity": 0.9,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
                "circle-radius": radiusExpression,
              },
            });
            instance.addLayer({
              id: "branch-labels",
              type: "symbol",
              source: SOURCE_BRANCHES,
              minzoom: branchWindow.minZoom,
              maxzoom: branchWindow.maxZoom,
              layout: {
                "text-field": [
                  "concat",
                  ["get", "name"],
                  "\n",
                  ["number-format", ["get", "total"], { locale: "id-ID" }],
                ],
                "text-size": 11,
                "text-font": ["Noto Sans Regular"],
                "text-line-height": 1.1,
                "text-max-width": 9,
                "text-variable-anchor": ["top", "bottom", "left", "right"],
                "text-radial-offset": 1.6,
                "text-justify": "auto",
                "symbol-sort-key": ["*", ["get", "total"], -1],
              },
              paint: {
                "text-color": MAP_BRAND.ink,
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.4,
              },
            });
            bindAggregate("branch-points", map.branches);
          }

          if (institutionWindow) {
            const institutionMinZoom = institutionWindow.minZoom;
            instance.addSource(SOURCE_POINTS, {
              type: "geojson",
              data: institutionCollection(map.points, map.maxTotal),
              cluster: true,
              clusterRadius: 46,
              clusterMaxZoom: Math.max(institutionMinZoom, 11),
              clusterProperties: {
                contentTotal: ["+", ["get", "total"]],
              },
            });
            instance.addLayer({
              id: "institution-clusters",
              type: "circle",
              source: SOURCE_POINTS,
              minzoom: institutionMinZoom,
              filter: ["has", "point_count"],
              paint: {
                "circle-color": MAP_BRAND.teal,
                "circle-opacity": 0.9,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
                "circle-radius": [
                  "interpolate",
                  ["linear"],
                  ["get", "contentTotal"],
                  1,
                  16,
                  40,
                  22,
                  150,
                  28,
                  600,
                  34,
                ],
              },
            });
            instance.addLayer({
              id: "institution-cluster-total",
              type: "symbol",
              source: SOURCE_POINTS,
              minzoom: institutionMinZoom,
              filter: ["has", "point_count"],
              layout: {
                "text-field": [
                  "number-format",
                  ["get", "contentTotal"],
                  { locale: "id-ID" },
                ],
                "text-size": 11,
                "text-font": ["Noto Sans Regular"],
              },
              paint: { "text-color": "#ffffff" },
            });
            instance.addLayer({
              id: "institution-points",
              type: "circle",
              source: SOURCE_POINTS,
              minzoom: institutionMinZoom,
              filter: ["!", ["has", "point_count"]],
              paint: {
                "circle-color": MAP_BRAND.green,
                "circle-opacity": 0.88,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5,
                "circle-radius": radiusExpression,
              },
            });
            instance.addLayer({
              id: "institution-count-label",
              type: "symbol",
              source: SOURCE_POINTS,
              minzoom: Math.max(
                institutionMinZoom,
                variant === "branch" ? 8 : 10,
              ),
              filter: ["!", ["has", "point_count"]],
              layout: {
                "text-field": [
                  "number-format",
                  ["get", "total"],
                  { locale: "id-ID" },
                ],
                "text-size": 10,
                "text-font": ["Noto Sans Regular"],
              },
              paint: { "text-color": "#ffffff" },
            });
            instance.addLayer({
              id: "institution-label",
              type: "symbol",
              source: SOURCE_POINTS,
              minzoom: Math.max(
                institutionMinZoom,
                variant === "branch" ? 9.5 : 11,
              ),
              filter: ["!", ["has", "point_count"]],
              layout: {
                "text-field": [
                  "concat",
                  ["get", "name"],
                  "\n",
                  ["number-format", ["get", "total"], { locale: "id-ID" }],
                ],
                "text-size": 11,
                "text-font": ["Noto Sans Regular"],
                "text-offset": [0, 1.4],
                "text-anchor": "top",
                "text-max-width": 12,
                "text-line-height": 1.1,
              },
              paint: {
                "text-color": MAP_BRAND.ink,
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.4,
              },
            });

            instance.on("click", "institution-clusters", (event) => {
              const feature = instance.queryRenderedFeatures(event.point, {
                layers: ["institution-clusters"],
              })[0];
              if (!feature) return;
              const clusterId = feature.properties?.cluster_id as number;
              const source = instance.getSource(SOURCE_POINTS) as GeoJSONSource;
              const geometry = feature.geometry as GeoPoint;
              source
                .getClusterExpansionZoom(clusterId)
                .then((zoom) => {
                  if (disposed) return;
                  instance.easeTo({
                    center: geometry.coordinates as [number, number],
                    zoom,
                    duration: 0,
                  });
                })
                .catch(() => undefined);
            });

            instance.on("click", "institution-points", (event) => {
              const feature = instance.queryRenderedFeatures(event.point, {
                layers: ["institution-points"],
              })[0];
              if (!feature) return;
              const properties = (feature.properties ?? {}) as Record<
                string,
                unknown
              >;
              const point = map.points.find(
                (item) => item.id === String(properties.id ?? ""),
              );
              new maplibregl.Popup({ offset: 12, maxWidth: "250px" })
                .setLngLat(event.lngLat)
                .setDOMContent(institutionPopup(properties, point))
                .addTo(instance);
            });

            for (const layer of [
              "institution-points",
              "institution-clusters",
            ]) {
              instance.on("mouseenter", layer, () => {
                instance.getCanvas().style.cursor = "pointer";
              });
              instance.on("mouseleave", layer, () => {
                instance.getCanvas().style.cursor = "";
              });
            }
          }

          const initialTier = mapTierForZoom(variant, 0) ?? "institution";
          const bounds = boundsFrom(
            maplibregl,
            initialCoordinates(map, initialTier),
          );
          if (bounds) {
            instance.fitBounds(bounds, {
              padding: { top: 40, right: 40, bottom: 40, left: 40 },
              maxZoom:
                initialTier === "region"
                  ? 6.4
                  : initialTier === "branch"
                    ? 8.4
                    : 12,
              duration: 0,
            });
          }

          const refreshTier = () => {
            if (disposed) return;
            const next = mapTierForZoom(variant, instance.getZoom());
            setTier((current) => (current === next ? current : next));
          };
          instance.on("zoomend", refreshTier);
          refreshTier();

          instance.on("error", (event) => {
            if (!loaded && !disposed) {
              setStatus("failed");
            } else if (!disposed) {
              console.warn("[dashboard-map] galat basemap", event.error);
            }
          });
        });

        slowTimer = setTimeout(() => {
          if (!loaded && !disposed) setStatus("failed");
        }, 15_000);
      } catch (error) {
        console.error("[dashboard-map] gagal memuat MapLibre", error);
        if (!disposed) setStatus("failed");
      }
    }

    if (typeof IntersectionObserver === "undefined") {
      begin();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) begin();
        },
        { rootMargin: "200px" },
      );
      observer.observe(containerEl);
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      if (slowTimer) clearTimeout(slowTimer);
      localMap?.remove();
    };
  }, [map, styleUrl, variant, attempt]);

  const { totals } = map;
  if (mapTierWindows(variant).length === 0) return null;

  return (
    <section
      id="peta"
      aria-labelledby="peta-judul"
      data-dashboard-panel="bleed"
      className="scroll-mt-20 rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3
              id="peta-judul"
              className="text-base font-semibold text-foreground"
            >
              Sebaran Konten
            </h3>
            <p className="max-w-prose text-xs text-ink-muted">
              Perbesar peta untuk berpindah dari wilayah ke cabang hingga
              institusi. Ukuran gelembung mengikuti jumlah konten tervalidasi.
            </p>
          </div>
          <div className="text-right text-xs text-ink-muted">
            <p className="font-semibold text-foreground tabular">
              {formatNumberId(totals.mappedApproved)} konten berlokasi
            </p>
            <p>
              {formatNumberId(totals.mappedInstitutions)} institusi ditampilkan
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            data-map-tier-label
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue-200 bg-brand-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-blue-700"
          >
            Tingkat: {tier ? MAP_TIER_LABELS[tier] : "Institusi"}
          </span>
          {DASHBOARD_CATEGORIES.map((category) => (
            <span
              key={category}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-xs text-ink-muted"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: CATEGORY_MAP_COLORS[category] }}
                aria-hidden
              />
              {DASHBOARD_CATEGORY_LABELS[category]}
            </span>
          ))}
        </div>
      </div>

      {map.points.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">
            Belum ada konten tervalidasi dengan lokasi pada cabang terpilih
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {totals.approved > 0
              ? "Seluruh konten pada cabang terpilih belum memiliki koordinat yang valid."
              : "Tidak ada konten tervalidasi pada cabang terpilih."}
          </p>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={containerRef}
            data-map-canvas
            data-map-tier={tier ?? "institution"}
            className="h-[280px] w-full sm:h-[310px] lg:h-[330px]"
            role="region"
            aria-label={`Peta interaktif sebaran konten pada ${formatNumberId(totals.mappedInstitutions)} institusi. Perbesar untuk berpindah tingkat. Rincian angka tersedia pada panel peringkat dan daftar institusi tanpa lokasi.`}
          />
          {status === "loading" ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/70 text-sm text-ink-muted">
              Memuat peta…
            </div>
          ) : null}
          {status === "failed" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/95 p-6">
              <div className="max-w-md text-center">
                <p className="text-sm font-semibold text-foreground">
                  Basemap tidak dapat dimuat
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  Koneksi ke penyedia peta gagal atau WebGL tidak tersedia.
                  Agregasi angka tetap lengkap pada panel peringkat dan daftar
                  institusi tanpa lokasi.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setStatus("loading");
                    setAttempt((value) => value + 1);
                  }}
                >
                  Coba lagi
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {totals.truncated ? (
        <p
          role="status"
          className="mx-4 mt-3 rounded-md border border-status-revision/30 bg-status-revision/10 px-3 py-2 text-xs text-status-revision sm:mx-5"
        >
          Peta menampilkan 5.000 institusi pertama dari{" "}
          {formatNumberId(totals.mappedInstitutions)} institusi berlokasi.
          Seluruh angka tetap dihitung pada total.
        </p>
      ) : null}

      {totals.missingApproved > 0 ? (
        <div className="mx-4 mt-3 rounded-md border border-status-review/30 bg-status-review/5 px-3 py-2 text-xs text-ink-muted sm:mx-5">
          <p>
            {formatNumberId(totals.missingApproved)} konten dari{" "}
            {formatNumberId(totals.missingInstitutions)} institusi belum
            memiliki koordinat valid dan tidak tampil sebagai titik.
          </p>
          {map.missingLocations.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                Institusi tanpa lokasi
              </summary>
              <ul
                className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                role="region"
                aria-label="Institusi tanpa lokasi, dapat digulir"
                tabIndex={0}
              >
                {map.missingLocations.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="min-w-0 break-words">
                      {row.name}
                      {row.branchName ? (
                        <span className="text-ink-muted">
                          {" "}
                          · {row.branchName}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-semibold text-foreground tabular">
                      {formatNumberId(row.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
