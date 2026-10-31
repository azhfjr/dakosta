"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import { Crosshair, Loader2, MapPin, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAP_BRAND } from "@/lib/chart-theme";
import { BANDUNG_CENTER, MAP_STYLE_URL, formatCoordinatePair, isValidCoordinate } from "@/lib/geo";

export type PickedLocation = {
  latitude: number;
  longitude: number;
  source: "device_gps" | "manual_pin";
  accuracyMeters: number | null;
  consentAt: string | null;
};

type MapLibreModule = Awaited<typeof import("maplibre-gl")>;

export function LocationPicker({
  value,
  onChange,
  describedBy,
}: {
  value: PickedLocation | null;
  onChange: (next: PickedLocation | null) => void;
  describedBy?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [gpsPending, setGpsPending] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        maplibreRef.current = maplibregl;

        // Turbopack resolves MapLibre's worker URL to the page URL; serve the bundled
        // worker as a static asset instead (see public/maplibre).
        maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

        const start = value ?? null;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: MAP_STYLE_URL,
          center: [
            start?.longitude ?? BANDUNG_CENTER.longitude,
            start?.latitude ?? BANDUNG_CENTER.latitude,
          ],
          zoom: start ? 14 : 12,
          attributionControl: { compact: true },
        });
        mapRef.current = map;

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

        map.on("load", () => {
          if (!cancelled) setMapLoaded(true);
        });

        map.on("error", () => {
          if (!cancelled && !map.loaded()) setMapFailed(true);
        });

        map.on("click", (event) => {
          onChangeRef.current({
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
            source: "manual_pin",
            accuracyMeters: null,
            consentAt: null,
          });
        });
      } catch {
        if (!cancelled) setMapFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Map is initialized once; value changes are handled by the marker sync effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl || !mapLoaded) return;

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const coordinates: [number, number] = [value.longitude, value.latitude];

    if (!markerRef.current) {
      const marker = new maplibregl.Marker({
        color: MAP_BRAND.greenDark,
        draggable: true,
      })
        .setLngLat(coordinates)
        .addTo(map);

      marker.on("dragend", () => {
        const position = marker.getLngLat();
        onChangeRef.current({
          latitude: position.lat,
          longitude: position.lng,
          source: "manual_pin",
          accuracyMeters: null,
          consentAt: null,
        });
      });

      markerRef.current = marker;
      map.jumpTo({ center: coordinates, zoom: Math.max(map.getZoom(), 13) });
    } else {
      markerRef.current.setLngLat(coordinates);
    }
  }, [value, mapLoaded]);

  function handleGeolocation() {
    setGpsError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError("Perangkat ini tidak menyediakan layanan lokasi. Tandai titik secara manual.");
      return;
    }

    setGpsPending(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChangeRef.current({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "device_gps",
          accuracyMeters: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          consentAt: new Date().toISOString(),
        });
        setGpsPending(false);
        setGpsError(null);
      },
      (error) => {
        setGpsPending(false);
        setGpsError(
          error.code === error.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Anda tetap dapat menandai titik manual di peta."
            : "Lokasi tidak dapat dibaca. Tandai titik manual di peta.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function applyManualCoordinates() {
    const latitude = Number(manualLat.replace(",", "."));
    const longitude = Number(manualLng.replace(",", "."));

    if (!isValidCoordinate(latitude, longitude)) {
      setManualError("Koordinat di luar rentang. Lintang -90..90, bujur -180..180.");
      return;
    }

    setManualError(null);
    onChangeRef.current({
      latitude,
      longitude,
      source: "manual_pin",
      accuracyMeters: null,
      consentAt: null,
    });

    const map = mapRef.current;
    if (map) map.flyTo({ center: [longitude, latitude], zoom: 14 });
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-muted">
        <div
          ref={containerRef}
          className="h-[320px] w-full"
          role="application"
          aria-label="Peta pemilihan lokasi konten"
          aria-describedby={describedBy}
        />
        {!mapLoaded && !mapFailed ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-muted/70">
            <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Memuat peta…
            </span>
          </div>
        ) : null}
        {mapFailed ? (
          <div className="absolute inset-x-0 bottom-0 border-t border-status-review/30 bg-status-review/10 px-4 py-2 text-xs text-status-revision">
            Peta tidak dapat dimuat. Gunakan tombol lokasi perangkat atau input koordinat
            manual di bawah.
          </div>
        ) : null}
        <div className="absolute top-3 right-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-surface shadow-sm"
            onClick={handleGeolocation}
            disabled={gpsPending}
          >
            {gpsPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Crosshair className="size-4" aria-hidden />
            )}
            {gpsPending ? "Membaca lokasi…" : "Gunakan lokasi saya"}
          </Button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-ink-muted">
        Klik peta untuk menandai titik konten. Lokasi dipakai untuk pemetaan
        organisasi dan disimpan sebagai perkiraan bila bukan GPS perangkat.
      </p>

      {gpsError ? (
        <p role="status" className="rounded-lg border border-status-revision/30 bg-status-revision/10 px-3 py-2 text-sm text-status-revision">
          {gpsError}
        </p>
      ) : null}

      {value ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-blue-100 bg-brand-blue-100/40 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-2 text-brand-blue-800">
            <MapPin className="size-4" aria-hidden />
            <span>
              {formatCoordinatePair(value.latitude, value.longitude)}
              <span className="ml-2 text-xs text-ink-muted">
                {value.source === "device_gps"
                  ? `GPS perangkat${value.accuracyMeters ? ` (±${Math.round(value.accuracyMeters)} m)` : ""}`
                  : "Titik manual"}
              </span>
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            <X className="size-4" aria-hidden />
            Hapus titik
          </Button>
        </div>
      ) : null}

      <details className="rounded-lg border border-border bg-surface-muted/60 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Input koordinat manual
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lokasi-lintang">Lintang</Label>
            <Input
              id="lokasi-lintang"
              inputMode="decimal"
              value={manualLat}
              onChange={(event) => setManualLat(event.target.value)}
              placeholder="-6.91750"
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lokasi-bujur">Bujur</Label>
            <Input
              id="lokasi-bujur"
              inputMode="decimal"
              value={manualLng}
              onChange={(event) => setManualLng(event.target.value)}
              placeholder="107.61910"
              className="h-11"
            />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" className="h-11" onClick={applyManualCoordinates}>
              Terapkan
            </Button>
          </div>
        </div>
        {manualError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {manualError}
          </p>
        ) : null}
      </details>
    </div>
  );
}
