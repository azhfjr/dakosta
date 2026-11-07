"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, Point as GeoPoint } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

import { formatNumberId } from "@/lib/dates";
import type { DashboardMap, DashboardMapPoint } from "@/lib/dashboard-map";
import { MAP_BRAND } from "@/lib/chart-theme";

const BANDUNG = { latitude: -6.9175, longitude: 107.6191 };
const SOURCE_POINTS = "aggregate-points";

type Status = "loading" | "ready" | "failed";

function collection(points: DashboardMapPoint[]): FeatureCollection<GeoPoint> {
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
        detail: point.detail,
        approved: point.approved,
        href: point.href,
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

function popupContent(properties: Record<string, unknown>): HTMLElement {
  const root = element("div", "space-y-1");
  root.append(
    element(
      "p",
      "text-sm font-semibold text-foreground",
      String(properties.name ?? ""),
    ),
  );
  const detail = String(properties.detail ?? "");
  if (detail) {
    root.append(element("p", "text-xs text-ink-muted", detail));
  }
  root.append(
    element(
      "p",
      "text-xs text-ink-muted",
      `${formatNumberId(Number(properties.approved ?? 0))} konten disetujui`,
    ),
  );
  const link = element(
    "a",
    "mt-1 inline-block text-xs font-semibold text-brand-blue-700 underline underline-offset-4",
    "Lihat kinerja",
  );
  link.href = String(properties.href ?? "#");
  root.append(link);
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
          });

          instance.addLayer({
            id: "aggregate-clusters",
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
            id: "aggregate-cluster-count",
            type: "symbol",
            source: SOURCE_POINTS,
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 12,
              "text-font": ["Noto Sans Regular"],
            },
            paint: { "text-color": "#ffffff" },
          });
          instance.addLayer({
            id: "aggregate-points",
            type: "circle",
            source: SOURCE_POINTS,
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": MAP_BRAND.blue,
              "circle-opacity": 0.85,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "approved"],
                1,
                7,
                100,
                12,
                1000,
                20,
              ],
            },
          });
          instance.addLayer({
            id: "aggregate-label",
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

          instance.on("click", "aggregate-clusters", (event) => {
            const feature = instance.queryRenderedFeatures(event.point, {
              layers: ["aggregate-clusters"],
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
                  duration: 250,
                });
              })
              .catch(() => undefined);
          });

          instance.on("click", "aggregate-points", (event) => {
            const feature = instance.queryRenderedFeatures(event.point, {
              layers: ["aggregate-points"],
            })[0];
            if (!feature) return;
            const properties = (feature.properties ?? {}) as Record<
              string,
              unknown
            >;
            new maplibregl.Popup({ offset: 12, maxWidth: "260px" })
              .setLngLat(event.lngLat)
              .setDOMContent(popupContent(properties))
              .addTo(instance);
          });

          for (const layer of ["aggregate-points", "aggregate-clusters"]) {
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
  }, [map, styleUrl]);

  const isBranch = map.level === "BRANCH";

  return (
    <section
      aria-labelledby="peta-dashboard-judul"
      className="rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2
              id="peta-dashboard-judul"
              className="text-base font-semibold text-foreground"
            >
              Peta capaian {isBranch ? "per cabang" : "per instansi"}
            </h2>
            <p className="text-xs text-ink-muted">
              Konten disetujui menurut tanggal approval final pada{" "}
              {map.period ? map.period.label : "seluruh periode"}.{" "}
              {isBranch ? "Titik cabang" : "Titik instansi"} berasal dari lokasi
              organisasi, bukan lokasi perangkat pengguna.
              {map.totals.zeroInstitutions > 0
                ? ` ${formatNumberId(map.totals.zeroInstitutions)} ${isBranch ? "cabang" : "instansi"} tanpa capaian tidak ditampilkan sebagai titik.`
                : ""}
            </p>
          </div>
          <div className="text-right text-xs text-ink-muted">
            <p className="font-semibold text-foreground tabular">
              {formatNumberId(map.totals.approved)} konten disetujui
            </p>
            <p>
              {formatNumberId(map.totals.locations)} titik ·{" "}
              {formatNumberId(map.totals.institutions)}{" "}
              {isBranch ? "cabang" : "instansi"} dalam scope
            </p>
          </div>
        </div>
        {map.truncated ? (
          <p
            role="status"
            className="rounded-md border border-status-revision/30 bg-status-revision/10 px-3 py-2 text-xs text-status-revision"
          >
            Peta dibatasi maksimum 5.000 titik. Persempit filter atau buka
            Kinerja untuk daftar lengkap.
          </p>
        ) : null}
      </div>

      {map.points.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">
            Belum ada lokasi dengan capaian approved
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Tidak ada konten disetujui pada periode ini, atau organisasi belum
            memiliki koordinat yang valid.
          </p>
          <Link
            href={isBranch ? "/wilayah/kinerja" : "/cabang/kinerja"}
            className="mt-3 inline-block text-sm font-semibold text-brand-blue-700 underline underline-offset-4"
          >
            Lihat tabel kinerja
          </Link>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={containerRef}
            className="h-[240px] w-full sm:h-[300px]"
            role="region"
            aria-label={`Peta interaktif capaian ${isBranch ? "cabang" : "instansi"}. Rincian angka tersedia pada tabel peringkat dan tabel konten disetujui di halaman ini.`}
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
                  Agregasi angka tetap lengkap pada tabel peringkat dan tabel
                  konten disetujui di halaman ini.
                </p>
                <a
                  href="#tabel"
                  className="mt-3 inline-block text-sm font-semibold text-brand-blue-700 underline underline-offset-4"
                >
                  Buka tabel konten disetujui
                </a>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
