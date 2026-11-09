"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import type { FeatureCollection, Point as GeoPoint } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

import type { AppRole } from "@/lib/authz/types";
import { MAP_BRAND, MAP_STATUS_COLOR as STATUS_COLOR } from "@/lib/chart-theme";
import { formatNumberId } from "@/lib/dates";
import type { MapPoint, MapSite } from "@/lib/map";

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "Disetujui",
  SUBMITTED: "Terkirim",
  REVISION_REQUIRED: "Perlu revisi",
  DRAFT: "Draf",
};

const BANDUNG = { latitude: -6.9175, longitude: 107.6191 };
const SOURCE_SUBMISSIONS = "submission-points";
const SOURCE_SITES = "stakeholder-sites";

type Status = "loading" | "ready" | "failed";

function submissionCollection(points: MapPoint[]): FeatureCollection<GeoPoint> {
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
        referenceCode: point.referenceCode,
        title: point.title ?? "(tanpa judul)",
        status: point.status,
        precision: point.precision,
        stakeholderName: point.stakeholderName,
        themeName: point.themeName,
        locationLabel: point.locationLabel,
        updatedAt: point.updatedAt,
        approvedAt: point.approvedAt,
        href: point.href,
      },
    })),
  };
}

function siteCollection(sites: MapSite[]): FeatureCollection<GeoPoint> {
  return {
    type: "FeatureCollection",
    features: sites.map((site) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [site.longitude, site.latitude],
      },
      properties: {
        id: site.id,
        name: site.name,
        category: site.category,
        serviceArea: site.serviceArea,
        submissionCount: site.submissionCount,
        precision: site.precision,
        href: site.href,
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

function buildSubmissionPopup(
  properties: Record<string, unknown>,
): HTMLElement {
  const root = element("div", "space-y-1.5");
  const heading = element(
    "p",
    "text-sm font-semibold text-foreground",
    String(properties.title ?? "(tanpa judul)"),
  );
  root.append(heading);

  const meta = element(
    "p",
    "text-xs text-ink-muted",
    `${String(properties.referenceCode)} · ${STATUS_LABEL[String(properties.status)] ?? String(properties.status)}`,
  );
  root.append(meta);

  root.append(
    element(
      "p",
      "text-xs text-ink-muted",
      `${String(properties.stakeholderName)} · ${String(properties.themeName)}`,
    ),
  );
  root.append(
    element(
      "p",
      "text-xs text-ink-muted",
      `Lokasi: ${String(properties.locationLabel)} (${
        properties.precision === "exact" ? "presisi" : "perkiraan"
      })`,
    ),
  );

  const link = element(
    "a",
    "mt-1 inline-block text-xs font-semibold text-brand-blue-700 underline underline-offset-4",
  );
  link.href = String(properties.href);
  link.textContent = "Buka detail konten";
  root.append(link);
  return root;
}

function buildSitePopup(properties: Record<string, unknown>): HTMLElement {
  const root = element("div", "space-y-1.5");
  root.append(
    element(
      "p",
      "text-sm font-semibold text-foreground",
      String(properties.name),
    ),
  );
  root.append(
    element(
      "p",
      "text-xs text-ink-muted",
      `${String(properties.category)} · ${String(properties.serviceArea)}`,
    ),
  );
  root.append(
    element(
      "p",
      "text-xs text-ink-muted",
      `${formatNumberId(Number(properties.submissionCount ?? 0))} konten pada filter ini`,
    ),
  );
  const link = element(
    "a",
    "mt-1 inline-block text-xs font-semibold text-brand-blue-700 underline underline-offset-4",
  );
  link.href = String(properties.href);
  link.textContent = "Lihat konten terkait";
  root.append(link);
  return root;
}

export function MapExplorer({
  points,
  sites,
  styleUrl,
  role,
}: {
  points: MapPoint[];
  sites: MapSite[];
  styleUrl: string;
  role: AppRole;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let disposed = false;
    let localMap: MapLibreMap | null = null;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;

    async function start() {
      try {
        const maplibregl = await import("maplibre-gl");
        if (disposed || !containerRef.current) return;
        maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: styleUrl,
          center: [BANDUNG.longitude, BANDUNG.latitude],
          zoom: 11,
          maxZoom: 18,
          attributionControl: { compact: true },
        });
        localMap = map;
        mapRef.current = map;

        map.addControl(
          new maplibregl.NavigationControl({ visualizePitch: false }),
          "top-right",
        );
        map.addControl(
          new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
          "bottom-left",
        );

        let loaded = false;
        map.on("load", () => {
          loaded = true;
          if (disposed) return;
          setStatus("ready");

          map.addSource(SOURCE_SUBMISSIONS, {
            type: "geojson",
            data: submissionCollection(points),
            cluster: true,
            clusterRadius: 52,
            clusterMaxZoom: 14,
          });
          map.addSource(SOURCE_SITES, {
            type: "geojson",
            data: siteCollection(sites),
          });

          map.addLayer({
            id: "sites-halo",
            type: "circle",
            source: SOURCE_SITES,
            paint: {
              "circle-radius": 11,
              "circle-color": MAP_BRAND.teal,
              "circle-opacity": 0.12,
            },
          });
          map.addLayer({
            id: "sites-circle",
            type: "circle",
            source: SOURCE_SITES,
            paint: {
              "circle-radius": 5.5,
              "circle-color": MAP_BRAND.teal,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            },
          });
          map.addLayer({
            id: "sites-label",
            type: "symbol",
            source: SOURCE_SITES,
            minzoom: 12.5,
            layout: {
              "text-field": ["get", "name"],
              "text-size": 11,
              "text-font": ["Noto Sans Regular"],
              "text-offset": [0, 1.3],
              "text-anchor": "top",
              "text-max-width": 12,
            },
            paint: {
              "text-color": MAP_BRAND.ink,
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.4,
            },
          });

          map.addLayer({
            id: "clusters",
            type: "circle",
            source: SOURCE_SUBMISSIONS,
            filter: ["has", "point_count"],
            paint: {
              "circle-color": MAP_BRAND.blue,
              "circle-opacity": 0.92,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
              "circle-radius": [
                "step",
                ["get", "point_count"],
                16,
                10,
                20,
                30,
                25,
              ],
            },
          });
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: SOURCE_SUBMISSIONS,
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 12,
              "text-font": ["Noto Sans Regular"],
            },
            paint: { "text-color": "#ffffff" },
          });

          const statusColor: ExpressionSpecification = [
            "match",
            ["get", "status"],
            "APPROVED",
            STATUS_COLOR.APPROVED,
            "SUBMITTED",
            STATUS_COLOR.SUBMITTED,
            "REVISION_REQUIRED",
            STATUS_COLOR.REVISION_REQUIRED,
            STATUS_COLOR.DRAFT,
          ];

          map.addLayer({
            id: "submission-exact",
            type: "circle",
            source: SOURCE_SUBMISSIONS,
            filter: [
              "all",
              ["!", ["has", "point_count"]],
              ["==", ["get", "precision"], "exact"],
            ],
            paint: {
              "circle-radius": 6.5,
              "circle-color": statusColor,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
            },
          });
          map.addLayer({
            id: "submission-approximate",
            type: "circle",
            source: SOURCE_SUBMISSIONS,
            filter: [
              "all",
              ["!", ["has", "point_count"]],
              ["==", ["get", "precision"], "approximate"],
            ],
            paint: {
              "circle-radius": 6.5,
              "circle-color": "#ffffff",
              "circle-opacity": 0.85,
              "circle-stroke-color": statusColor,
              "circle-stroke-width": 2.5,
            },
          });

          const bounds = new maplibregl.LngLatBounds();
          for (const point of points) {
            bounds.extend([point.longitude, point.latitude]);
          }
          for (const site of sites) {
            bounds.extend([site.longitude, site.latitude]);
          }
          if (!bounds.isEmpty()) {
            map.fitBounds(bounds, {
              padding: { top: 48, right: 48, bottom: 48, left: 48 },
              maxZoom: 13,
              duration: 0,
            });
          }

          map.on("click", "clusters", (event) => {
            const feature = map.queryRenderedFeatures(event.point, {
              layers: ["clusters"],
            })[0];
            if (!feature) return;
            const clusterId = feature.properties?.cluster_id as number;
            const source = map.getSource(SOURCE_SUBMISSIONS) as GeoJSONSource;
            const geometry = feature.geometry as GeoPoint;
            source
              .getClusterExpansionZoom(clusterId)
              .then((zoom) => {
                if (disposed) return;
                map.easeTo({
                  center: geometry.coordinates as [number, number],
                  zoom,
                  duration: 300,
                });
              })
              .catch(() => undefined);
          });

          const interactionLayers = [
            "submission-exact",
            "submission-approximate",
            "sites-circle",
          ];

          map.on("click", (event: MapLayerMouseEvent) => {
            const features = map.queryRenderedFeatures(event.point, {
              layers: interactionLayers,
            });
            const feature = features[0];
            if (!feature) return;
            const layerId = feature.layer?.id ?? "";
            const properties = (feature.properties ?? {}) as Record<
              string,
              unknown
            >;
            const node =
              layerId === "sites-circle"
                ? buildSitePopup(properties)
                : buildSubmissionPopup(properties);
            new maplibregl.Popup({ offset: 14, maxWidth: "280px" })
              .setLngLat(event.lngLat)
              .setDOMContent(node)
              .addTo(map);
          });

          for (const layer of interactionLayers) {
            map.on("mouseenter", layer, () => {
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", layer, () => {
              map.getCanvas().style.cursor = "";
            });
          }

          map.on("error", (event) => {
            if (!loaded && !disposed) {
              setStatus("failed");
            } else if (!disposed) {
              console.warn("[peta] galat basemap", event.error);
            }
          });
        });

        slowTimer = setTimeout(() => {
          if (!loaded && !disposed) setStatus("failed");
        }, 15_000);
      } catch (error) {
        console.error("[peta] gagal memuat MapLibre", error);
        if (!disposed) setStatus("failed");
      }
    }

    void start();

    return () => {
      disposed = true;
      if (slowTimer) clearTimeout(slowTimer);
      localMap?.remove();
      mapRef.current = null;
    };
    // Data perubahan ditangani dengan me-remount komponen lewat key pada halaman.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      aria-labelledby="peta-judul"
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2
              id="peta-judul"
              className="text-base font-semibold text-foreground"
            >
              Sebaran konten dan lokasi stakeholder
            </h2>
            <p className="text-xs text-ink-muted">
              Titik konten mengikuti lokasi terlapor. Lingkaran teal menandai
              lokasi stakeholder terdaftar.
            </p>
          </div>
          <p className="text-xs text-ink-muted">
            {formatNumberId(points.length)} titik konten ·{" "}
            {formatNumberId(sites.length)} lokasi stakeholder
          </p>
        </div>
      </div>

      <div className="relative">
        <div
          ref={containerRef}
          className="h-[420px] w-full sm:h-[520px]"
          role="region"
          aria-label="Peta interaktif konten dan stakeholder. Gunakan tabel di bawah halaman sebagai alternatif yang dapat diakses keyboard."
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
                Koneksi ke penyedia peta gagal atau WebGL tidak tersedia. Data
                tetap lengkap pada tabel di bawah peta.
              </p>
              <a
                href="#tabel-peta"
                className="mt-3 inline-block text-sm font-semibold text-brand-blue-700 underline underline-offset-4"
              >
                Lihat tabel sebaran konten
              </a>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <li className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLOR.APPROVED }}
              aria-hidden
            />
            Disetujui
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLOR.SUBMITTED }}
              aria-hidden
            />
            Terkirim
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLOR.REVISION_REQUIRED }}
              aria-hidden
            />
            Perlu Revisi
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full border-2 bg-white"
              style={{ borderColor: STATUS_COLOR.DRAFT }}
              aria-hidden
            />
            Lokasi perkiraan (cincin)
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: MAP_BRAND.teal }}
              aria-hidden
            />
            Lokasi stakeholder
          </li>
        </ul>
        <p>
          {role === "STAKEHOLDER"
            ? "Peta hanya menampilkan data stakeholder Anda."
            : "Klik penanda untuk detail konten."}
        </p>
      </div>
    </section>
  );
}
