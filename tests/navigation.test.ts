import { describe, expect, it } from "vitest";

import { getNavItems, getNavSections } from "@/components/shell/navigation";
import type { AppRole } from "@/lib/authz/types";

const PRIMARY_LABELS: Record<AppRole, string[]> = {
  MASTER_ADMIN: [
    "Dashboard",
    "SLA",
    "Kinerja",
    "Detail Konten",
    "Red Notice",
    "Notifikasi",
  ],
  REGIONAL_ADMIN: [
    "Dashboard",
    "SLA",
    "Kinerja",
    "Detail Konten",
    "Red Notice",
    "Notifikasi",
  ],
  BRANCH_ADMIN: [
    "Dashboard",
    "SLA",
    "Kinerja",
    "Detail Konten",
    "Red Notice",
    "Notifikasi",
  ],
  STAKEHOLDER: ["Dashboard", "Detail Konten", "Notifikasi"],
};

describe("role navigation", () => {
  for (const role of Object.keys(PRIMARY_LABELS) as AppRole[]) {
    it(`keeps the mandated primary order for ${role}`, () => {
      const sections = getNavSections(role);
      expect(sections[0]?.items.map((item) => item.label)).toEqual(
        PRIMARY_LABELS[role],
      );
    });

    it(`never exposes Cabang or Organisasi to ${role}`, () => {
      const labels = getNavItems(role).map((item) => item.label);
      expect(labels).not.toContain("Cabang");
      expect(labels).not.toContain("Organisasi");
    });
  }

  it("starts Regional and Branch at their dashboards", () => {
    expect(getNavItems("REGIONAL_ADMIN")[0]?.href).toBe("/wilayah/dashboard");
    expect(getNavItems("BRANCH_ADMIN")[0]?.href).toBe("/cabang/dashboard");
  });

  it("moves Master management tools into a separate section", () => {
    const sections = getNavSections("MASTER_ADMIN");
    expect(sections).toHaveLength(2);
    expect(sections[1]?.label).toBe("Manajemen");
    expect(sections[1]?.items.map((item) => item.label)).toContain("Akun");
  });
});
