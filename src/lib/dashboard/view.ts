import { redirectToAnchor } from "@/lib/filters/redirect";
import { firstParam, type FilterParams } from "@/lib/filters/query";

const VIEW_ANCHORS: Record<string, string> = {
  konten: "tabel",
  "semua-konten": "tabel",
  disetujui: "tabel",
  "konten-disetujui": "tabel",
  tabel: "tabel",
  peta: "peta",
  peringkat: "peringkat",
  pencapaian: "pencapaian-cabang",
  "pencapaian-cabang": "pencapaian-cabang",
  "tren-bulanan": "tren-bulanan",
  bulanan: "tren-bulanan",
  tema: "tren-tema",
  "tren-tema": "tren-tema",
  "jenis-platform": "tren-jenis-platform",
  "tren-jenis-platform": "tren-jenis-platform",
};

export function dashboardViewAnchor(params: FilterParams): string | null {
  const view = firstParam(params, "view")?.toLowerCase();
  if (!view) return null;
  return VIEW_ANCHORS[view] ?? null;
}

/** `?view=` deep links land on the matching dashboard section. */
export function redirectDashboardView(
  basePath: string,
  params: FilterParams,
): void {
  const anchor = dashboardViewAnchor(params);
  if (anchor) redirectToAnchor(basePath, params, anchor);
}
