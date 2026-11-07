import { redirectToAnchor } from "@/lib/filters/redirect";
import { firstParam, type FilterParams } from "@/lib/filters/query";

/**
 * Legacy `?view=` links still resolve to the closest section of the current
 * dashboard so bookmarks never land on a dead anchor.
 */
const VIEW_ANCHORS: Record<string, string> = {
  ringkasan: "ringkasan",
  pencapaian: "konten-per-cabang",
  "pencapaian-cabang": "konten-per-cabang",
  "konten-per-cabang": "konten-per-cabang",
  konten: "kolaborasi",
  "semua-konten": "kolaborasi",
  disetujui: "kolaborasi",
  "konten-disetujui": "kolaborasi",
  tabel: "kolaborasi",
  peringkat: "kolaborasi",
  kolaborasi: "kolaborasi",
  pilihCabang: "pilih-cabang",
  "pilih-cabang": "pilih-cabang",
  fkrtl: "fkrtl",
  fktp: "fktp",
  pemda: "pemda",
  stakeholder: "stakeholder",
  peta: "peta",
  tema: "tema-konten",
  "tema-konten": "tema-konten",
  "tren-tema": "tema-konten",
  "tren-bulanan": "konten-per-cabang",
  bulanan: "konten-per-cabang",
  "jenis-platform": "tema-konten",
  "tren-jenis-platform": "tema-konten",
  edufast: "edufast",
  nonEdufast: "non-edufast",
  "non-edufast": "non-edufast",
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
