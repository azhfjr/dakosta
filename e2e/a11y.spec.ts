import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
}

async function expectAccessible(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const violations = await seriousViolations(page);
  expect(
    violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(" ")).slice(0, 3),
    })),
    `Pelanggaran aksesibilitas di ${path}`,
  ).toEqual([]);
}

test.describe("Aksesibilitas halaman publik", () => {
  test("beranda dan masuk bebas pelanggaran serius", async ({ page }) => {
    await expectAccessible(page, "/");
    await expectAccessible(page, "/masuk");
  });
});

test.describe("Aksesibilitas ruang kerja", () => {
  test("dashboard Master dan Red Notice", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    try {
      const page = await context.newPage();
      await expectAccessible(page, "/admin");
      await expectAccessible(page, "/admin/red-notice");
      await expectAccessible(page, "/admin/edufast");
    } finally {
      await context.close();
    }
  });

  test("dashboard wilayah bersifat baca-saja dan aksesibel", async ({ browser }) => {
    const context = await browser.newContext({ storageState: REGIONAL_STATE });
    try {
      const page = await context.newPage();
      await expectAccessible(page, "/wilayah");
      await expectAccessible(page, "/wilayah/red-notice");
    } finally {
      await context.close();
    }
  });

  test("dashboard dan antrean cabang", async ({ browser }) => {
    const context = await browser.newContext({ storageState: BRANCH_STATE });
    try {
      const page = await context.newPage();
      await expectAccessible(page, "/cabang");
      await expectAccessible(page, "/cabang/review");
    } finally {
      await context.close();
    }
  });

  test("ruang stakeholder dan wizard", async ({ browser }) => {
    const context = await browser.newContext({ storageState: CLIENT_STATE });
    try {
      const page = await context.newPage();
      await expectAccessible(page, "/client");
      await expectAccessible(page, "/client/lapor");
    } finally {
      await context.close();
    }
  });
});

test.describe("Tata letak seluler", () => {
  test("tidak ada gulir horizontal pada 360px", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: CLIENT_STATE,
      viewport: { width: 360, height: 800 },
    });
    try {
      const page = await context.newPage();
      for (const path of ["/client", "/client/lapor", "/client/konten"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `Gulir horizontal di ${path}`).toBeLessThanOrEqual(1);
      }
    } finally {
      await context.close();
    }
  });

  test("navigasi cabang dapat dibuka pada layar kecil", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: BRANCH_STATE,
      viewport: { width: 360, height: 800 },
    });
    try {
      const page = await context.newPage();
      await page.goto("/cabang");
      const toggle = page.getByRole("button", { name: /menu|navigasi/i }).first();
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(page.getByRole("navigation").first()).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
