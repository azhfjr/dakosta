import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

const DASHBOARDS = [
  {
    name: "admin",
    path: "/admin",
    state: ADMIN_STATE,
    hasBranchAchievement: false,
  },
  {
    name: "wilayah",
    path: "/wilayah/dashboard",
    state: REGIONAL_STATE,
    hasBranchAchievement: true,
  },
  {
    name: "cabang",
    path: "/cabang/dashboard",
    state: BRANCH_STATE,
    hasBranchAchievement: false,
  },
  {
    name: "stakeholder",
    path: "/client",
    state: CLIENT_STATE,
    hasBranchAchievement: false,
  },
];

/** Offsets are compared instead of DOM order because Sections are siblings. */
async function sectionOffsets(
  page: Page,
  ids: string[],
): Promise<(number | null)[]> {
  return page.evaluate(
    (sectionIds) =>
      sectionIds.map((id) => {
        const node = document.getElementById(id);
        if (!node) return null;
        return node.getBoundingClientRect().top + window.scrollY;
      }),
    ids,
  );
}

for (const dashboard of DASHBOARDS) {
  test.describe(`Dashboard ${dashboard.name}`, () => {
    test.use({ storageState: dashboard.state });

    test("hanya menampilkan blok disetujui dalam urutan wajib", async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.goto(dashboard.path);

      await expect(
        page.getByRole("region", { name: "Ringkasan capaian disetujui" }),
      ).toBeVisible();
      await expect(
        page.getByText("Hanya status Disetujui").first(),
      ).toBeVisible();

      await expect(page.locator("#semua-konten")).toHaveCount(0);
      await expect(page.getByText("Komposisi status konten")).toHaveCount(0);
      await expect(
        page.getByRole("region", { name: "Filter dasbor" }),
      ).toHaveCount(0);

      const expected = [
        "peta",
        "peringkat",
        "tren-bulanan",
        "tren-tema",
        "tren-jenis-platform",
        "tabel",
      ];
      if (dashboard.hasBranchAchievement) expected.unshift("pencapaian-cabang");
      else await expect(page.locator("#pencapaian-cabang")).toHaveCount(0);

      const offsets = await sectionOffsets(page, expected);
      for (const [index, offset] of offsets.entries()) {
        expect(offset, `${expected[index]} harus ada`).not.toBeNull();
      }
      for (let index = 1; index < offsets.length; index += 1) {
        expect(
          offsets[index]!,
          `${expected[index]} harus berada setelah ${expected[index - 1]}`,
        ).toBeGreaterThan(offsets[index - 1]!);
      }

      expect(pageErrors).toEqual([]);
    });

    test("filter tabel mengubah URL tanpa menghapus blok lain", async ({
      page,
    }) => {
      await page.goto(dashboard.path);
      const filter = page.getByRole("region", {
        name: "Filter konten disetujui",
      });
      await expect(filter).toBeVisible();

      const subTheme = filter.locator('select[name="subTheme"]');
      await expect(subTheme).toBeVisible();
      await subTheme.selectOption({ index: 1 });
      await page.waitForURL(/subTheme=/);
      await expect(subTheme).not.toHaveValue("");

      await expect(page.locator("#tabel")).toHaveCount(1);
      await expect(page.locator("#peta")).toHaveCount(1);
      await expect(page.locator("#tren-bulanan")).toHaveCount(1);
    });
  });
}
