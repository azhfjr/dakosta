/**
 * Dashboard v3 visual audit.
 *
 * Captures the four roles at desktop, tablet, and mobile widths against an
 * already-running local/staging server. Requires `e2e/.auth/*.json` sessions
 * produced by the E2E global setup. Never prints credentials.
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:3300 node scripts/dashboard-visual-audit.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://localhost:${process.env.E2E_PORT ?? "3300"}`;

const ROLES = [
  { name: "master", state: "admin.json", path: "/admin" },
  { name: "regional", state: "regional.json", path: "/wilayah/dashboard" },
  { name: "branch", state: "branch-a1.json", path: "/cabang/dashboard" },
  { name: "stakeholder", state: "client.json", path: "/client" },
];

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "375", width: 375, height: 812 },
];

const SECTIONS = [
  "ringkasan",
  "konten-per-cabang",
  "kolaborasi",
  "pilih-cabang",
  "fkrtl",
  "fktp",
  "pemda",
  "stakeholder",
  "peta",
  "tema-konten",
  "edufast",
  "non-edufast",
];

const outDir = join("docs", "audit", "evidence", "dashboard-v3");

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const results = [];

  try {
    for (const role of ROLES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          storageState: join("e2e", ".auth", role.state),
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();
        const consoleErrors = [];
        const pageErrors = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));

        try {
          const response = await page.goto(`${baseURL}${role.path}`, {
            waitUntil: "domcontentloaded",
            timeout: 120_000,
          });
          if (!response || response.status() >= 400) {
            throw new Error(`HTTP ${response?.status() ?? "tanpa respons"}`);
          }
          await page.locator("#non-edufast").waitFor({
            state: "visible",
            timeout: 120_000,
          });
          // The map initialises only once it intersects the viewport, so scroll
          // to it before capturing a full-page screenshot.
          await page.locator("#peta").scrollIntoViewIfNeeded();
          let mapReady = false;
          try {
            await page
              .locator("#peta .maplibregl-canvas")
              .waitFor({ state: "visible", timeout: 60_000 });
            await page
              .locator("#peta")
              .getByText("Memuat peta…", { exact: true })
              .waitFor({ state: "detached", timeout: 60_000 });
            const mapFailed = await page
              .locator("#peta")
              .getByText("Basemap tidak dapat dimuat")
              .count();
            mapReady = mapFailed === 0;
          } catch {
            mapReady = false;
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(1200);

          const missing = await page.evaluate(
            (ids) => ids.filter((id) => !document.getElementById(id)),
            SECTIONS,
          );
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          const pageHeight = await page.evaluate(
            () => document.documentElement.scrollHeight,
          );
          const viewportHeight = await page.evaluate(() => window.innerHeight);
          const fitsOnePage = pageHeight <= viewportHeight + 2;
          const screenshot = join(outDir, `${role.name}-${viewport.name}.png`);
          await page.screenshot({ path: screenshot, fullPage: true });

          results.push({
            role: role.name,
            path: role.path,
            viewport: viewport.name,
            screenshot,
            mapReady,
            missingSections: missing,
            horizontalOverflowPx: Math.max(0, overflow),
            pageHeight,
            viewportHeight,
            fitsOnePage,
            consoleErrors,
            pageErrors,
            ok:
              missing.length === 0 &&
              mapReady &&
              overflow <= 1 &&
              pageErrors.length === 0 &&
              (viewport.name !== "1440" || fitsOnePage),
          });
          console.log(
            `${role.name} ${viewport.name}: ${missing.length === 0 ? "section lengkap" : `hilang ${missing.join(", ")}`}, peta ${mapReady ? "siap" : "belum siap"}, overflow ${Math.max(0, overflow)}px, tinggi ${pageHeight}px${viewport.name === "1440" ? ` (${fitsOnePage ? "muat" : "melebihi"} satu layar)` : ""}, ${pageErrors.length} page error.`,
          );
        } catch (error) {
          results.push({
            role: role.name,
            path: role.path,
            viewport: viewport.name,
            screenshot: null,
            error: error instanceof Error ? error.message : String(error),
            consoleErrors,
            pageErrors,
            ok: false,
          });
          console.error(
            `${role.name} ${viewport.name}: GAGAL — ${error instanceof Error ? error.message : error}`,
          );
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  const evidence = join(outDir, "visual-audit.json");
  await writeFile(
    evidence,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseURL,
        results,
        passed: results.filter((result) => result.ok).length,
        failed: results.filter((result) => !result.ok).length,
      },
      null,
      2,
    )}\n`,
  );

  const failed = results.filter((result) => !result.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} tangkapan layar lolos. Evidence: ${evidence}`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
