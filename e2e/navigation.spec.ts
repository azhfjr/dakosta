import { expect, test } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

const ROLES = [
  { name: "master", state: ADMIN_STATE, dashboard: "/admin" },
  { name: "regional", state: REGIONAL_STATE, dashboard: "/wilayah/dashboard" },
  { name: "branch", state: BRANCH_STATE, dashboard: "/cabang/dashboard" },
  { name: "client", state: CLIENT_STATE, dashboard: "/client" },
];

test.describe("Navigasi per peran", () => {
  test("satu menu Dashboard tanpa Analitik atau tautan duplikat", async ({
    browser,
  }) => {
    for (const role of ROLES) {
      const context = await browser.newContext({ storageState: role.state });
      const page = await context.newPage();
      try {
        await page.goto(role.dashboard);
        await expect(
          page.getByRole("link", { name: "Dashboard", exact: true }).first(),
        ).toBeVisible();
        await expect(page.locator('a[href$="/analitik"]')).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Analitik", exact: true }),
        ).toHaveCount(0);
      } finally {
        await context.close();
      }
    }
  });

  test("regional dan cabang mendapat menu Konten", async ({ browser }) => {
    const regional = await browser.newContext({ storageState: REGIONAL_STATE });
    const regionalPage = await regional.newPage();
    await regionalPage.goto("/wilayah/dashboard");
    await expect(
      regionalPage.locator('a[href="/wilayah/konten"]').first(),
    ).toBeVisible();
    await regional.close();

    const branch = await browser.newContext({ storageState: BRANCH_STATE });
    const branchPage = await branch.newPage();
    await branchPage.goto("/cabang/dashboard");
    await expect(
      branchPage.locator('a[href="/cabang/konten"]').first(),
    ).toBeVisible();
    await branch.close();
  });
});

test.describe("Redirect lama mempertahankan filter", () => {
  test("analitik admin menuju section Semua Konten", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await context.newPage();
    await page.goto("/admin/analitik?period=2026-01");
    await page.waitForURL(/#semua-konten$/);
    expect(page.url()).toContain("period=2026-01");
    await expect(page.locator("#semua-konten")).toHaveCount(1);
    await context.close();
  });

  test("analitik client menuju section Konten Disetujui", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: CLIENT_STATE });
    const page = await context.newPage();
    await page.goto("/client/analitik");
    await page.waitForURL(/#konten-disetujui$/);
    await expect(page.locator("#konten-disetujui")).toHaveCount(1);
    await context.close();
  });

  test("peta cabang dan view=peta menuju anchor peta", async ({ browser }) => {
    const context = await browser.newContext({ storageState: BRANCH_STATE });
    const page = await context.newPage();
    await page.goto("/cabang/peta");
    await page.waitForURL(/#peta$/);
    await expect(page.locator("#peta")).toHaveCount(1);

    await page.goto("/cabang/dashboard?view=peta&period=2026-01");
    await page.waitForURL(/#peta$/);
    expect(page.url()).toContain("period=2026-01");
    await context.close();
  });
});
