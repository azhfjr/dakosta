"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, Point as GeoPoint } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

import { Button } from "@/components/ui/button";
import { CATEGORY_MAP_COLORS, MAP_BRAND } from "@/lib/chart-theme";
import {
  DASHBOARD_CATEGORIES,
  DASHBOARD_CATEGORY_LABELS,
  type DashboardCategory,
  type DashboardMap,
  type DashboardMapPoint,
} from "@/lib/dashboard/types";
import { formatNumberId } from "@/lib/dates";

const BANDUNG = { latitude: -6.9175, longitude: 107.6191 };
const SOURCE_POINTS = "dashboard-institutions";

type Status = "loading" | "ready" | "failed";

type PointProperties = {
  id: string;
  name: string;
  branchName: string;
  total: number;
  FKRTL: number;
  FKTP: number;
  PEMDA: number;
  STAKEHOLDER: number;
};

function collection(
  points: DashboardMapPoint[],
): FeatureCollection<GeoPoint, PointProperties> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.longitude, point.latitude],
      },
      properties: {
        id: point.id,
        name: point.name,
        branchName: point.branchName ?? "",
        total: point.total,
        FKRTL: point.categories.FKRTL,
        FKTP: point.categories.FKTP,
        PEMDA: point.categories.PEMDA,
        STAKEHOLDER: point.categories.STAKEHOLDER,
      },
    })),
  };
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

function popupContent(properties: Record<string, unknown>): HTMLElement {
  const root = element("div", "min-w-[190px] space-y-1");
  root.append(
    element(
      "p",
      "text-sm font-semibold text-foreground",
      String(properties.name ?? "Tanpa nama"),
    ),
  );
  const branchName = String(properties.branchName ?? "");
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
  const list = element("ul", "mt-2 space-y-1");
  for (const category of DASHBOARD_CATEGORIES) {
    list.append(chip(category, Number(properties[category] ?? 0)));
  }
  root.append(list);
  return root;
}

export function DashboardMapSection({
  map,
  styleUrl,
}: {
  map: DashboardMap;
  styleUrl: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>(
    map.points.length === 0 ? "ready" : "loading",
  );

  useEffect(() => {
    if (map.points.length === 0) return;
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
          maxZoom: 18,
          attributionControl: { compact: true },
        });
        localMap = instance;

        instance.addControl(
          new maplibregl.NavigationControl({ visualizePitch: false }),
          "top-right",
        );
        instance.addControl(
          new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
          "bottom-left",
        );

        let loaded = false;
        instance.on("load", () => {
          loaded = true;
          if (disposed) return;
          setStatus("ready");

          instance.addSource(SOURCE_POINTS, {
            type: "geojson",
            data: collection(map.points),
            cluster: true,
            clusterRadius: 48,
            clusterMaxZoom: 13,
            clusterProperties: {
              contentTotal: ["+", ["get", "total"]],
            },
          });

          instance.addLayer({
            id: "institution-clusters",
            type: "circle",
            source: SOURCE_POINTS,
            filter: ["has", "point_count"],
            paint: {
              "circle-color": MAP_BRAND.blue,
              "circle-opacity": 0.9,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
              "circle-radius": [
                "step",
                ["get", "point_count"],
                16,
                20,
                22,
                100,
                28,
              ],
            },
          });
          instance.addLayer({
            id: "institution-cluster-total",
            type: "symbol",
            source: SOURCE_POINTS,
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
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": MAP_BRAND.green,
              "circle-opacity": 0.85,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "total"],
                1,
                7,
                50,
                11,
                500,
                17,
              ],
            },
          });
          instance.addLayer({
            id: "institution-label",
            type: "symbol",
            source: SOURCE_POINTS,
            filter: ["!", ["has", "point_count"]],
            minzoom: 11,
            layout: {
              "text-field": ["get", "name"],
              "text-size": 11,
              "text-font": ["Noto Sans Regular"],
              "text-offset": [0, 1.2],
              "text-anchor": "top",
              "text-max-width": 12,
            },
            paint: {
              "text-color": MAP_BRAND.ink,
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.4,
            },
          });

          const bounds = new maplibregl.LngLatBounds();
          for (const point of map.points) {
            bounds.extend([point.longitude, point.latitude]);
          }
          if (!bounds.isEmpty()) {
            instance.fitBounds(bounds, {
              padding: { top: 40, right: 40, bottom: 40, left: 40 },
              maxZoom: 12,
              duration: 0,
            });
          }

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
            new maplibregl.Popup({ offset: 12, maxWidth: "250px" })
              .setLngLat(event.lngLat)
              .setDOMContent(popupContent(properties))
              .addTo(instance);
          });

          for (const layer of ["institution-points", "institution-clusters"]) {
            instance.on("mouseenter", layer, () => {
              instance.getCanvas().style.cursor = "pointer";
            });
            instance.on("mouseleave", layer, () => {
              instance.getCanvas().style.cursor = "";
            });
          }

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
  }, [map, styleUrl, attempt]);

  const { totals } = map;

  return (
    <section
      id="peta"
      aria-labelledby="peta-judul"
      className="rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3
              id="peta-judul"
              className="text-base font-semibold text-foreground"
            >
              Sebaran Konten
            </h3>
            <p className="text-xs text-ink-muted">
              Titik institusi memakai koordinat asli organisasi pada cabang
              terpilih. Angka pada klaster adalah total konten tervalidasi.
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
        <div className="flex flex-wrap gap-1.5">
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
            className="h-[260px] w-full sm:h-[340px]"
            role="region"
            aria-label={`Peta interaktif sebaran konten pada ${formatNumberId(totals.mappedInstitutions)} institusi. Rincian angka tersedia pada panel peringkat dan daftar institusi tanpa lokasi.`}
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
