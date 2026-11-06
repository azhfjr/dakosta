import { redirectToAnchor } from "@/lib/filters/redirect";
import { firstParam, type FilterParams } from "@/lib/filters/query";

const VIEW_ANCHORS: Record<string, string> = {
  konten: "semua-konten",
  "semua-konten": "semua-konten",
  disetujui: "konten-disetujui",
  "konten-disetujui": "konten-disetujui",
  peta: "peta",
  tabel: "tabel",
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
