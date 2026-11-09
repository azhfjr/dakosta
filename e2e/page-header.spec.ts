import { expect, test } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

const PAGES = [
  {
    name: "dashboard master",
    path: "/admin",
    state: ADMIN_STATE,
    actions: true,
    meta: true,
  },
  {
    name: "detail konten master",
    path: "/admin/konten",
    state: ADMIN_STATE,
    actions: true,
    meta: true,
  },
  {
    name: "target",
    path: "/admin/target",
    state: ADMIN_STATE,
    actions: false,
    meta: true,
  },
  {
    name: "SLA master",
    path: "/admin/validasi",
    state: ADMIN_STATE,
    actions: true,
    meta: true,
  },
  // Demo mode disables region editing, so this page ships without header actions.
  {
    name: "wilayah",
    path: "/admin/wilayah",
    state: ADMIN_STATE,
    actions: false,
    meta: false,
  },
  {
    name: "dashboard wilayah",
    path: "/wilayah/dashboard",
    state: REGIONAL_STATE,
    actions: true,
    meta: true,
  },
  {
    name: "SLA wilayah",
    path: "/wilayah",
    state: REGIONAL_STATE,
    actions: true,
    meta: true,
  },
  {
    name: "dashboard cabang",
    path: "/cabang/dashboard",
    state: BRANCH_STATE,
    actions: true,
    meta: true,
  },
  {
    name: "SLA cabang",
    path: "/cabang",
    state: BRANCH_STATE,
    actions: true,
    meta: true,
  },
  {
    name: "beranda stakeholder",
    path: "/client",
    state: CLIENT_STATE,
    actions: true,
    meta: true,
  },
  {
    name: "detail konten stakeholder",
    path: "/client/konten",
    state: CLIENT_STATE,
    actions: true,
    meta: true,
  },
] as const;

type HeaderPage = (typeof PAGES)[number];

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 812 };

async function openPage(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  // The shell streams a workspace loading fallback before the real page.
  await page
    .locator("[data-page-header]")
    .waitFor({ state: "visible", timeout: 60_000 });
}

async function headerMetrics(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    function box(selector: string) {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    }
    return {
      header: box("[data-page-header]"),
      actions: box("[data-page-header-actions]"),
      meta: box("[data-page-header-meta]"),
      buttons: [
        ...(document
          .querySelector("[data-page-header-actions]")
          ?.querySelectorAll("button, a") ?? []),
      ]
        .filter((node) => node.getBoundingClientRect().height > 0)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return { height: rect.height, width: rect.width };
        }),
      overflow: Math.max(
        0,
        document.documentElement.scrollWidth - window.innerWidth,
      ),
    };
  });
}

for (const config of PAGES as readonly HeaderPage[]) {
  test.describe(`header ${config.name}`, () => {
    test.use({ storageState: config.state });

    test("aksi rata kanan dan meta rapi di desktop", async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await openPage(page, config.path);
      const metrics = await headerMetrics(page);

      expect(metrics.header).not.toBeNull();
      if (config.actions) {
        expect(metrics.actions).not.toBeNull();
        expect(
          Math.abs(metrics.header!.right - metrics.actions!.right),
        ).toBeLessThanOrEqual(2);
        // The action column sits beside the title block, not under it.
        expect(metrics.actions!.top).toBeLessThan(metrics.header!.bottom - 4);
        for (const button of metrics.buttons) {
          expect(button.height).toBeGreaterThanOrEqual(35);
          expect(button.height).toBeLessThanOrEqual(42);
        }
      } else {
        expect(metrics.actions).toBeNull();
      }

      if (config.meta) {
        expect(metrics.meta).not.toBeNull();
        expect(
          Math.abs(metrics.header!.right - metrics.meta!.right),
        ).toBeLessThanOrEqual(2);
        if (config.actions) {
          const stackGap = metrics.meta!.top - metrics.actions!.bottom;
          expect(stackGap).toBeGreaterThanOrEqual(7);
          expect(stackGap).toBeLessThanOrEqual(24);
        }
      } else {
        expect(metrics.meta).toBeNull();
      }
    });

    test("tanpa overflow horizontal di mobile", async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await openPage(page, config.path);
      const metrics = await headerMetrics(page);

      expect(metrics.header).not.toBeNull();
      expect(metrics.overflow).toBeLessThanOrEqual(1);

      if (config.actions) {
        expect(metrics.actions).not.toBeNull();
        expect(metrics.actions!.left).toBeGreaterThanOrEqual(0);
        expect(metrics.actions!.right).toBeLessThanOrEqual(MOBILE.width + 1);
        for (const button of metrics.buttons) {
          expect(button.height).toBeGreaterThanOrEqual(40);
        }
      }
      if (config.meta) {
        expect(metrics.meta).not.toBeNull();
        expect(metrics.meta!.left).toBeGreaterThanOrEqual(0);
        expect(metrics.meta!.right).toBeLessThanOrEqual(MOBILE.width + 1);
        if (config.actions) {
          expect(metrics.meta!.top).toBeGreaterThanOrEqual(
            metrics.actions!.bottom - 1,
          );
        }
      }
    });
  });
}
