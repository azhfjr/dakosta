export const BANDUNG_CENTER = {
  latitude: -6.9175,
  longitude: 107.6191,
} as const;

export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() ||
  "https://tiles.openfreemap.org/styles/positron";

export type LocationPrecision = "exact" | "approximate";

export function resolvePrecision(
  source: "device_gps" | "manual_pin" | "registered_stakeholder",
  accuracyMeters?: number | null,
): LocationPrecision {
  if (
    source === "device_gps" &&
    typeof accuracyMeters === "number" &&
    accuracyMeters <= 100
  ) {
    return "exact";
  }
  return "approximate";
}

export function formatCoordinatePair(
  latitude: number,
  longitude: number,
): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function isValidCoordinate(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
