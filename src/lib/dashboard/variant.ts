import type { AppRole } from "@/lib/authz/types";
import {
  parseBranchSelection,
  type BranchSelection,
} from "@/lib/filters/branch-selection";
import { firstParam, type FilterParams } from "@/lib/filters/query";

export type DashboardVariant =
  "national" | "regional" | "branch" | "stakeholder";

export type DashboardSection =
  | "ringkasan"
  | "konten-per-cabang"
  | "konten-per-institusi"
  | "kolaborasi"
  | "peta"
  | "tema-konten";

const SECTIONS: Record<DashboardVariant, readonly DashboardSection[]> = {
  national: [
    "ringkasan",
    "konten-per-cabang",
    "kolaborasi",
    "peta",
    "tema-konten",
  ],
  regional: [
    "ringkasan",
    "konten-per-cabang",
    "kolaborasi",
    "peta",
    "tema-konten",
  ],
  branch: [
    "ringkasan",
    "konten-per-institusi",
    "kolaborasi",
    "peta",
    "tema-konten",
  ],
  stakeholder: ["ringkasan", "tema-konten"],
};

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

const BRANCH_ANCHOR_OVERRIDES: Record<string, string> = {
  "konten-per-cabang": "konten-per-institusi",
  "pilih-cabang": "ringkasan",
};

const STAKEHOLDER_ANCHORS = new Set([
  "ringkasan",
  "tema-konten",
  "edufast",
  "non-edufast",
]);

export function dashboardVariant(role: AppRole): DashboardVariant {
  switch (role) {
    case "MASTER_ADMIN":
      return "national";
    case "REGIONAL_ADMIN":
      return "regional";
    case "BRANCH_ADMIN":
      return "branch";
    case "STAKEHOLDER":
      return "stakeholder";
  }
}

export function dashboardSections(
  variant: DashboardVariant,
): readonly DashboardSection[] {
  return SECTIONS[variant];
}

/**
 * Master and regional dashboards are the only ones with a branch checklist.
 * Branch and stakeholder scopes are fixed, so a stale `?cabang=none` link must
 * never empty their data.
 */
export function selectionForDashboard(
  variant: DashboardVariant,
  params: FilterParams,
  allowedIds: readonly string[],
): BranchSelection {
  if (variant === "branch" || variant === "stakeholder") {
    return { mode: "not-applicable", ids: [] };
  }
  return parseBranchSelection(params, allowedIds);
}

export function dashboardViewAnchor(
  params: FilterParams,
  variant: DashboardVariant = "national",
): string | null {
  const view = firstParam(params, "view")?.toLowerCase();
  if (!view) return null;
  const anchor = VIEW_ANCHORS[view];
  if (!anchor) return null;
  if (variant === "branch") return BRANCH_ANCHOR_OVERRIDES[anchor] ?? anchor;
  if (variant === "stakeholder") {
    return STAKEHOLDER_ANCHORS.has(anchor) ? anchor : "ringkasan";
  }
  return anchor;
}
