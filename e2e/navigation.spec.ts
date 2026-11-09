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

test.describe("Tata letak shell", () => {
  test("sidebar selebar 240px di seluruh peran tanpa overflow", async ({
    browser,
  }) => {
    for (const role of ROLES) {
      const context = await browser.newContext({
        storageState: role.state,
        viewport: { width: 1440, height: 900 },
      });
      try {
        const page = await context.newPage();
        await page.goto(role.dashboard);
        const aside = page.locator("aside").first();
        await expect(aside).toBeVisible({ timeout: 30_000 });
        const box = await aside.boundingBox();
        expect(box).not.toBeNull();
        expect(Math.round(box!.width)).toBe(240);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
      } finally {
        await context.close();
      }
    }
  });

  test("stakeholder mendapat Input Konten hijau tepat di bawah Dashboard", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: CLIENT_STATE,
      viewport: { width: 1440, height: 900 },
    });
    try {
      const page = await context.newPage();
      await page.goto("/client");
      const nav = page
        .getByRole("navigation", { name: "Navigasi utama" })
        .first();
      await expect(nav).toBeVisible({ timeout: 30_000 });

      const links = nav.locator("a");
      await expect(links.nth(0)).toHaveAttribute("href", "/client");
      const input = links.nth(1);
      await expect(input).toHaveAttribute("href", "/client/lapor");
      await expect(input).toContainText("Input Konten");

      const styles = await input.evaluate((node) => {
        const computed = getComputedStyle(node);
        return { background: computed.backgroundColor, color: computed.color };
      });
      expect(styles.background).toBe("rgb(15, 122, 70)");
      expect(styles.color).toBe("rgb(255, 255, 255)");

      await input.click();
      await page.waitForURL(/\/client\/lapor$/);
      await expect(
        page
          .getByRole("navigation", { name: "Navigasi utama" })
          .first()
          .getByRole("link", { name: "Input Konten" }),
      ).toHaveAttribute("aria-current", "page");
    } finally {
      await context.close();
    }
  });

  test("menu mobile stakeholder juga memuat Input Konten", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: CLIENT_STATE,
      viewport: { width: 390, height: 844 },
    });
    try {
      const page = await context.newPage();
      await page.goto("/client");
      await page.getByRole("button", { name: "Buka menu navigasi" }).click();
      const nav = page.getByRole("navigation", { name: "Navigasi utama" });
      await expect(
        nav.getByRole("link", { name: "Input Konten" }),
      ).toBeVisible();
      await expect(nav.locator("a").nth(1)).toHaveAttribute(
        "href",
        "/client/lapor",
      );
    } finally {
      await context.close();
    }
  });
});

test.describe("Master tanpa menu Input Konten", () => {
  test.use({ storageState: ADMIN_STATE });

  test("menu master tidak memuat Input Konten", async ({ page }) => {
    await page.goto("/admin");
    const nav = page
      .getByRole("navigation", { name: "Navigasi utama" })
      .first();
    await expect(nav).toBeVisible({ timeout: 30_000 });
    await expect(nav.getByRole("link", { name: "Input Konten" })).toHaveCount(
      0,
    );
  });
});

test.describe("Notifikasi memakai lebar penuh", () => {
  const NOTIFICATIONS = [
    { ...ROLES[0]!, path: "/admin/notifikasi" },
    { ...ROLES[1]!, path: "/wilayah/notifikasi" },
    { ...ROLES[2]!, path: "/cabang/notifikasi" },
    { ...ROLES[3]!, path: "/client/notifikasi" },
  ];

  test("halaman notifikasi mengisi lebar 1440px tanpa overflow", async ({
    browser,
  }) => {
    for (const role of NOTIFICATIONS) {
      const context = await browser.newContext({
        storageState: role.state,
        viewport: { width: 1920, height: 1080 },
      });
      try {
        const page = await context.newPage();
        await page.goto(role.path);
        const container = page.locator("[data-page-container]").first();
        await expect(container).toBeVisible({ timeout: 30_000 });
        const box = await container.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThan(1_300);
        expect(box!.width).toBeLessThanOrEqual(1_441);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
      } finally {
        await context.close();
      }
    }
  });
});

test.describe("Redirect lama mempertahankan filter", () => {
  test("analitik admin menuju SLA dengan filter utuh", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await context.newPage();
    await page.goto("/admin/analitik?period=2026-01");
    await page.waitForURL(/\/admin\/validasi\?period=2026-01$/);
    expect(page.url()).toContain("period=2026-01");
    await expect(
      page.getByRole("heading", { name: "SLA Master" }),
    ).toBeVisible();
    await context.close();
  });

  test("analitik client menuju Detail Konten", async ({ browser }) => {
    const context = await browser.newContext({ storageState: CLIENT_STATE });
    const page = await context.newPage();
    await page.goto("/client/analitik");
    await page.waitForURL(/\/client\/konten$/);
    await expect(
      page.getByRole("heading", { name: "Detail Konten", level: 1 }),
    ).toBeVisible();
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

  test("view lama bulanan dan jenis konten tidak menabrak anchor mati", async ({
    browser,
  }) => {
    const master = await browser.newContext({ storageState: ADMIN_STATE });
    try {
      const page = await master.newPage();
      for (const [view, anchor] of [
        ["tren-bulanan", "tren-bulanan"],
        ["bulanan", "tren-bulanan"],
        ["jenis-platform", "tema-konten"],
      ]) {
        await page.goto(`/admin?view=${view}`);
        await page.waitForURL(new RegExp(`#${anchor}$`));
        await expect(page.locator(`#${anchor}`)).toHaveCount(1);
      }
    } finally {
      await master.close();
    }

    const client = await browser.newContext({ storageState: CLIENT_STATE });
    try {
      const page = await client.newPage();
      for (const [view, anchor] of [
        ["jenis-platform", "jenis-konten"],
        ["tren-jenis-platform", "tren-jenis-konten"],
        ["tren-tema", "tren-tema"],
      ]) {
        await page.goto(`/client?view=${view}`);
        await page.waitForURL(new RegExp(`#${anchor}$`));
        await expect(page.locator(`#${anchor}`)).toHaveCount(1);
      }
    } finally {
      await client.close();
    }
  });

  test("menu lama Cabang, Organisasi, SLA, dan Kinerja tetap dapat dibuka", async ({
    browser,
  }) => {
    const master = await browser.newContext({ storageState: ADMIN_STATE });
    try {
      const page = await master.newPage();
      for (const [from, to] of [
        ["/admin/cabang", "/admin/wilayah"],
        ["/admin/organisasi", "/admin/wilayah"],
        ["/admin/sla", "/admin/validasi"],
        ["/admin/kinerja", "/admin/laporan"],
      ]) {
        await page.goto(from);
        await page.waitForURL(new RegExp(`${to}$`));
      }
    } finally {
      await master.close();
    }

    const regional = await browser.newContext({ storageState: REGIONAL_STATE });
    try {
      const page = await regional.newPage();
      for (const [from, to] of [
        ["/wilayah/cabang", "/wilayah/dashboard"],
        ["/wilayah/organisasi", "/wilayah/dashboard"],
        ["/wilayah/sla", "/wilayah"],
      ]) {
        await page.goto(from);
        await page.waitForURL(new RegExp(`${to}$`));
      }
    } finally {
      await regional.close();
    }

    const branch = await browser.newContext({ storageState: BRANCH_STATE });
    try {
      const page = await branch.newPage();
      for (const [from, to] of [
        ["/cabang/organisasi", "/cabang/dashboard"],
        ["/cabang/sla", "/cabang"],
      ]) {
        await page.goto(from);
        await page.waitForURL(new RegExp(`${to}$`));
      }
    } finally {
      await branch.close();
    }
  });
});
