import { expect, test } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

const DASHBOARDS = [
  { name: "admin", path: "/admin", state: ADMIN_STATE },
  { name: "wilayah", path: "/wilayah/dashboard", state: REGIONAL_STATE },
  { name: "cabang", path: "/cabang/dashboard", state: BRANCH_STATE },
  { name: "stakeholder", path: "/client", state: CLIENT_STATE },
];

for (const dashboard of DASHBOARDS) {
  test.describe(`Dashboard ${dashboard.name}`, () => {
    test.use({ storageState: dashboard.state });

    test("memisahkan semua konten dan konten disetujui", async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", (error) => consoleErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });

      await page.goto(dashboard.path);

      await expect(
        page.getByRole("region", { name: "Filter dasbor" }),
      ).toBeVisible();

      const allContent = page.locator("#semua-konten");
      const approved = page.locator("#konten-disetujui");
      await expect(allContent).toHaveCount(1);
      await expect(approved).toHaveCount(1);

      await expect(
        allContent.getByRole("heading", { name: "Semua konten", exact: true }),
      ).toBeVisible();
      await expect(
        approved.getByRole("heading", {
          name: "Konten disetujui",
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        allContent.getByText("Semua status", { exact: true }),
      ).toBeVisible();
      await expect(
        approved.getByText("Hanya status Disetujui", { exact: true }),
      ).toBeVisible();

      await allContent.scrollIntoViewIfNeeded();
      await expect(allContent.getByText("Komposisi status konten")).toBeVisible(
        { timeout: 20_000 },
      );

      await approved.scrollIntoViewIfNeeded();
      await expect(approved.getByText("Tren persetujuan")).toBeVisible({
        timeout: 20_000,
      });

      expect(consoleErrors).toEqual([]);
    });

    test("filter dasbor mengubah URL dan kedua bagian tetap ada", async ({
      page,
    }) => {
      await page.goto(dashboard.path);
      const filter = page.getByRole("region", { name: "Filter dasbor" });
      const subTheme = filter.locator('select[name="subTheme"]');
      await expect(subTheme).toBeVisible();

      await subTheme.selectOption({ index: 1 });
      await page.waitForURL(/subTheme=/);
      await expect(subTheme).not.toHaveValue("");
      await expect(page.locator("#semua-konten")).toHaveCount(1);
      await expect(page.locator("#konten-disetujui")).toHaveCount(1);
    });
  });
}
