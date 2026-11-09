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
  | "tren-bulanan"
  | "jenis-konten"
  | "tren-jenis-konten"
  | "tren-tema"
  | "kolaborasi"
  | "peta"
  | "tema-konten";

const SECTIONS: Record<DashboardVariant, readonly DashboardSection[]> = {
  national: [
    "ringkasan",
    "konten-per-cabang",
    "tren-bulanan",
    "kolaborasi",
    "peta",
    "tema-konten",
  ],
  regional: [
    "ringkasan",
    "konten-per-cabang",
    "tren-bulanan",
    "kolaborasi",
    "peta",
    "tema-konten",
  ],
  branch: [
    "ringkasan",
    "konten-per-institusi",
    "tren-bulanan",
    "kolaborasi",
    "peta",
    "tema-konten",
  ],
  stakeholder: [
    "ringkasan",
    "jenis-konten",
    "tren-bulanan",
    "tren-jenis-konten",
    "tren-tema",
    "tema-konten",
  ],
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
  "tren-tema": "tren-tema",
  "tren-bulanan": "tren-bulanan",
  bulanan: "tren-bulanan",
  "jenis-konten": "jenis-konten",
  "jenis-platform": "jenis-konten",
  "tren-jenis-konten": "tren-jenis-konten",
  "tren-jenis-platform": "tren-jenis-konten",
  edufast: "edufast",
  nonEdufast: "non-edufast",
  "non-edufast": "non-edufast",
};

const VARIANT_ANCHOR_FALLBACKS: Record<
  DashboardVariant,
  Record<string, string>
> = {
  national: {
    "jenis-konten": "tema-konten",
    "tren-jenis-konten": "tema-konten",
    "tren-tema": "tema-konten",
  },
  regional: {
    "jenis-konten": "tema-konten",
    "tren-jenis-konten": "tema-konten",
    "tren-tema": "tema-konten",
  },
  branch: {
    "konten-per-cabang": "konten-per-institusi",
    "jenis-konten": "tema-konten",
    "tren-jenis-konten": "tema-konten",
    "tren-tema": "tema-konten",
  },
  stakeholder: {
    "konten-per-cabang": "ringkasan",
    "konten-per-institusi": "ringkasan",
    kolaborasi: "ringkasan",
    peta: "ringkasan",
    "pilih-cabang": "ringkasan",
    fkrtl: "ringkasan",
    fktp: "ringkasan",
    pemda: "ringkasan",
    stakeholder: "ringkasan",
  },
};

const PASSTHROUGH_ANCHORS: Record<DashboardVariant, Set<string>> = {
  national: new Set([
    "pilih-cabang",
    "fkrtl",
    "fktp",
    "pemda",
    "stakeholder",
    "edufast",
    "non-edufast",
  ]),
  regional: new Set([
    "pilih-cabang",
    "fkrtl",
    "fktp",
    "pemda",
    "stakeholder",
    "edufast",
    "non-edufast",
  ]),
  branch: new Set([
    "fkrtl",
    "fktp",
    "pemda",
    "stakeholder",
    "edufast",
    "non-edufast",
  ]),
  stakeholder: new Set(["edufast", "non-edufast"]),
};

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

  const sections = SECTIONS[variant];
  if ((sections as readonly string[]).includes(anchor)) return anchor;
  if (PASSTHROUGH_ANCHORS[variant].has(anchor)) return anchor;
  return VARIANT_ANCHOR_FALLBACKS[variant][anchor] ?? sections[0]!;
}
