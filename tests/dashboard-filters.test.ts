import { describe, expect, it } from "vitest";

import { dashboardViewAnchor } from "@/lib/dashboard/view";

describe("dashboard view anchors", () => {
  it("maps legacy content anchors onto current sections", () => {
    expect(dashboardViewAnchor({ view: "konten" })).toBe("kolaborasi");
    expect(dashboardViewAnchor({ view: "konten-disetujui" })).toBe(
      "kolaborasi",
    );
    expect(dashboardViewAnchor({ view: "tabel" })).toBe("kolaborasi");
    expect(dashboardViewAnchor({ view: "peringkat" })).toBe("kolaborasi");
    expect(dashboardViewAnchor({ view: "peta" })).toBe("peta");
    expect(dashboardViewAnchor({ view: "tren-tema" })).toBe("tema-konten");
    expect(dashboardViewAnchor({ view: "pencapaian-cabang" })).toBe(
      "konten-per-cabang",
    );
    expect(dashboardViewAnchor({ view: "tren-bulanan" })).toBe(
      "konten-per-cabang",
    );
  });

  it("keeps current anchors stable", () => {
    expect(dashboardViewAnchor({ view: "ringkasan" })).toBe("ringkasan");
    expect(dashboardViewAnchor({ view: "kolaborasi" })).toBe("kolaborasi");
    expect(dashboardViewAnchor({ view: "pilih-cabang" })).toBe("pilih-cabang");
    expect(dashboardViewAnchor({ view: "fkrtl" })).toBe("fkrtl");
    expect(dashboardViewAnchor({ view: "fktp" })).toBe("fktp");
    expect(dashboardViewAnchor({ view: "pemda" })).toBe("pemda");
    expect(dashboardViewAnchor({ view: "stakeholder" })).toBe("stakeholder");
    expect(dashboardViewAnchor({ view: "tema-konten" })).toBe("tema-konten");
    expect(dashboardViewAnchor({ view: "edufast" })).toBe("edufast");
    expect(dashboardViewAnchor({ view: "non-edufast" })).toBe("non-edufast");
  });

  it("returns null for unknown views", () => {
    expect(dashboardViewAnchor({ view: "lama" })).toBeNull();
    expect(dashboardViewAnchor({})).toBeNull();
  });
});
