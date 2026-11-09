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
  STAKEHOLDER: ["Dashboard", "Input Konten", "Detail Konten", "Notifikasi"],
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

  it("puts Input Konten directly after Dashboard for stakeholders only", () => {
    for (const role of Object.keys(PRIMARY_LABELS) as AppRole[]) {
      const index = getNavItems(role).findIndex(
        (item) => item.label === "Input Konten",
      );
      if (role === "STAKEHOLDER") {
        expect(index).toBe(1);
      } else {
        expect(index).toBe(-1);
      }
    }
    const input = getNavItems("STAKEHOLDER").find(
      (item) => item.label === "Input Konten",
    );
    expect(input).toMatchObject({
      href: "/client/lapor",
      tone: "success",
      ready: true,
    });
  });

  it("moves Master management tools into a separate section", () => {
    const sections = getNavSections("MASTER_ADMIN");
    expect(sections).toHaveLength(2);
    expect(sections[1]?.label).toBe("Manajemen");
    expect(sections[1]?.items.map((item) => item.label)).toContain("Akun");
  });
});
