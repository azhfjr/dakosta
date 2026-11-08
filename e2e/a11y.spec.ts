import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Frame, type Page } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
}

const DASHBOARD_PATHS = new Set([
  "/admin",
  "/client",
  "/wilayah/dashboard",
  "/cabang/dashboard",
]);

async function waitForStable(page: Page, quietMs = 700): Promise<void> {
  // Turbopack dev mode can trigger a full reload after it finishes compiling a
  // route for the first time; wait until the main frame has been quiet so
  // measurements do not race an in-flight reload.
  let lastNavigation = Date.now();
  const record = (frame: Frame) => {
    if (frame === page.mainFrame()) lastNavigation = Date.now();
  };
  page.on("framenavigated", record);
  try {
    for (let waited = 0; waited < 15_000; waited += 150) {
      if (Date.now() - lastNavigation >= quietMs) return;
      await page.waitForTimeout(150);
    }
  } finally {
    page.off("framenavigated", record);
  }
}

async function settle(page: Page, path: string): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("main").first().waitFor({
    state: "visible",
    timeout: 30_000,
  });
  const currentPath = new URL(page.url()).pathname;
  if (DASHBOARD_PATHS.has(path) || DASHBOARD_PATHS.has(currentPath)) {
    // Dashboard groups stream independently; wait for the last anchors instead
    // of networkidle, which the notification stream keeps pending forever.
    await page.locator("#non-edufast").waitFor({
      state: "visible",
      timeout: 60_000,
    });
    await page.locator("#peta").waitFor({ state: "visible", timeout: 60_000 });
  } else {
    await page
      .waitForLoadState("networkidle", { timeout: 5_000 })
      .catch(() => undefined);
  }
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.waitForTimeout(200);
  await waitForStable(page);
}

const RELOAD_ERROR = "Execution context was destroyed";

async function withReloadRetry<T>(
  page: Page,
  path: string,
  action: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes(RELOAD_ERROR)) {
        throw error;
      }
      lastError = error;
      await page
        .waitForLoadState("domcontentloaded", { timeout: 15_000 })
        .catch(() => undefined);
      await settle(page, path);
    }
  }
  throw lastError;
}

async function expectAccessible(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await settle(page, path);
  const violations = await withReloadRetry(page, path, () =>
    seriousViolations(page),
  );
  expect(
    violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(" ")).slice(0, 3),
    })),
    `Pelanggaran aksesibilitas di ${path}`,
  ).toEqual([]);
}

async function expectNoOverflow(
  page: Page,
  path: string,
  label = path,
): Promise<void> {
  await page.goto(path);
  await settle(page, path);
  const overflow = await withReloadRetry(page, path, () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  );
  expect(overflow, `Gulir horizontal di ${label}`).toBeLessThanOrEqual(1);
}

test.describe("Aksesibilitas halaman publik", () => {
  test("beranda dan masuk bebas pelanggaran serius", async ({ page }) => {
    await expectAccessible(page, "/");
    await expectAccessible(page, "/masuk");
  });
});

test.describe("Aksesibilitas ruang kerja", () => {
  test("dashboard Master, konten, dan Red Notice", async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    try {
      const page = await context.newPage();
      await expectAccessible(page, "/admin");
      await expectAccessible(page, "/admin/konten");
      await expectAccessible(page, "/admin/red-notice");
      await expectAccessible(page, "/admin/edufast");
    } finally {
      await context.close();
    }
  });

  test("dashboard wilayah bersifat baca-saja dan aksesibel", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: REGIONAL_STATE });
    try {
      const page = await context.newPage();
      await expectAccessible(page, "/wilayah");
      await expectAccessible(page, "/wilayah/dashboard");
      await expectAccessible(page, "/wilayah/konten");
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
      await expectAccessible(page, "/cabang/dashboard");
      await expectAccessible(page, "/cabang/konten");
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

test.describe("Reflow 320px (setara zoom 400%)", () => {
  test("dashboard stakeholder dan daftar konten tidak menggulir horizontal", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: CLIENT_STATE,
      viewport: { width: 320, height: 800 },
    });
    try {
      const page = await context.newPage();
      for (const path of ["/client", "/client/lapor", "/client/konten"]) {
        await expectNoOverflow(page, path);
      }
    } finally {
      await context.close();
    }
  });

  test("dashboard dan antrean cabang tidak menggulir horizontal", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: BRANCH_STATE,
      viewport: { width: 320, height: 800 },
    });
    try {
      const page = await context.newPage();
      for (const path of ["/cabang", "/cabang/dashboard", "/cabang/konten"]) {
        await expectNoOverflow(page, path);
      }
    } finally {
      await context.close();
    }
  });

  test("dashboard dan daftar konten wilayah tidak menggulir horizontal", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: REGIONAL_STATE,
      viewport: { width: 320, height: 800 },
    });
    try {
      const page = await context.newPage();
      for (const path of [
        "/wilayah/dashboard",
        "/wilayah/konten",
        "/wilayah/kinerja",
      ]) {
        await expectNoOverflow(page, path);
      }
    } finally {
      await context.close();
    }
  });

  test("dashboard Master tidak menggulir horizontal", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: ADMIN_STATE,
      viewport: { width: 320, height: 800 },
    });
    try {
      const page = await context.newPage();
      for (const path of ["/admin", "/admin/konten"]) {
        await expectNoOverflow(page, path);
      }
    } finally {
      await context.close();
    }
  });
});

test.describe("Matriks viewport 640/768/1440", () => {
  const matrix = [
    {
      name: "stakeholder",
      state: CLIENT_STATE,
      paths: ["/client", "/client/konten"],
    },
    {
      name: "cabang",
      state: BRANCH_STATE,
      paths: ["/cabang", "/cabang/konten"],
    },
    {
      name: "wilayah",
      state: REGIONAL_STATE,
      paths: ["/wilayah/dashboard", "/wilayah/konten"],
    },
    { name: "Master", state: ADMIN_STATE, paths: ["/admin", "/admin/konten"] },
  ] as const;

  for (const entry of matrix) {
    test(`${entry.name} tidak menggulir horizontal pada 640/768/1440`, async ({
      browser,
    }) => {
      for (const width of [640, 768, 1440]) {
        const context = await browser.newContext({
          storageState: entry.state,
          viewport: { width, height: 900 },
        });
        try {
          const page = await context.newPage();
          for (const path of entry.paths) {
            await expectNoOverflow(page, path, `${path} @ ${width}px`);
          }
        } finally {
          await context.close();
        }
      }
    });
  }
});

test.describe("Keyboard dan fokus", () => {
  test("skip link, checklist, dan area bergulir dapat dijangkau keyboard", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    try {
      const page = await context.newPage();
      await page.goto("/admin");
      await settle(page, "/admin");
      await expect(page.locator("#konten-per-cabang")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator("#pilih-cabang")).toBeVisible({
        timeout: 30_000,
      });

      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Lewati ke konten utama" });
      await expect(skip).toBeFocused();
      await expect(skip).toBeVisible();
      const skipOutline = await skip.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          width: Number.parseFloat(style.outlineWidth),
          style: style.outlineStyle,
        };
      });
      expect(skipOutline.style).not.toBe("none");
      expect(skipOutline.width).toBeGreaterThanOrEqual(2);

      await page.keyboard.press("Enter");
      await expect(page.locator("#konten")).toBeInViewport();

      const selectAll = page.locator("#pilih-semua-cabang");
      await selectAll.focus();
      await expect(selectAll).toBeFocused();

      const chartRegion = page.getByRole("region", {
        name: "Grafik konten per cabang, dapat digulir",
      });
      await expect(chartRegion).toHaveAttribute("tabindex", "0");
      await chartRegion.focus();
      await expect(chartRegion).toBeFocused();

      const summary = page.locator("#pilih-cabang summary");
      await summary.focus();
      await expect(summary).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("#pilih-cabang details")).toHaveJSProperty(
        "open",
        true,
      );

      const checklistRegion = page.getByRole("region", {
        name: "Daftar cabang, dapat digulir",
      });
      await expect(checklistRegion).toBeVisible();
      await expect(checklistRegion).toHaveAttribute("tabindex", "0");
      await checklistRegion.focus();
      await expect(checklistRegion).toBeFocused();
    } finally {
      await context.close();
    }
  });
});

test.describe("Tata letak seluler", () => {
  test("navigasi cabang dapat dibuka pada layar kecil", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: BRANCH_STATE,
      viewport: { width: 360, height: 800 },
    });
    try {
      const page = await context.newPage();
      await page.goto("/cabang");
      const toggle = page
        .getByRole("button", { name: /menu|navigasi/i })
        .first();
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(page.getByRole("navigation").first()).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
