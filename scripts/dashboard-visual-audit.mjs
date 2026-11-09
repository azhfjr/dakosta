/**
 * Dashboard v3 visual audit.
 *
 * Captures the four roles at desktop, tablet, and mobile widths against an
 * already-running local/staging server. Requires `e2e/.auth/*.json` sessions
 * produced by the E2E global setup. Never prints credentials.
 *
 * Gating verifies proportional charts/map, minimum panel and bar sizes, and
 * zero overlaps. Page height is recorded as information only: the v3 concept
 * scrolls at 1440 instead of compressing content into one screen.
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

const LAYOUT_LIMITS = {
  1440: { chartWidth: 1000, mapWidth: 1000, mapHeight: 320, panelWidth: 520 },
  768: { chartWidth: 600, mapWidth: 600, mapHeight: 300, panelWidth: 330 },
  375: { chartWidth: 280, mapWidth: 280, mapHeight: 240, panelWidth: 320 },
};

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

const GAP_PAIRS = [
  ["ringkasan", "konten-per-cabang"],
  ["konten-per-cabang", "kolaborasi"],
  ["pilih-cabang", "fkrtl"],
  ["fkrtl", "pemda"],
  ["stakeholder", "peta"],
  ["peta", "tema-konten"],
];

const outDir = join("docs", "audit", "evidence", "dashboard-v3");

async function measureLayout(page) {
  return page.evaluate(
    ({ gapPairs, panelIds }) => {
      function box(node) {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top + window.scrollY,
          right: rect.right,
          bottom: rect.bottom + window.scrollY,
          width: rect.width,
          height: rect.height,
        };
      }
      const byId = (id) => box(document.getElementById(id));
      const boxes = Object.fromEntries(
        [
          ...new Set([
            ...gapPairs.flatMap(([from, to]) => [from, to]),
            ...panelIds,
          ]),
        ].map((id) => [id, byId(id)]),
      );

      const gaps = gapPairs.map(([from, to]) => ({
        from,
        to,
        gap:
          boxes[from] && boxes[to] ? boxes[to].top - boxes[from].bottom : null,
      }));

      const chartNode = document.querySelector(
        '#konten-per-cabang [role="region"][aria-label^="Grafik konten"]',
      );
      const chart = chartNode
        ? {
            ...box(chartNode),
            svg: chartNode.querySelector("svg") !== null,
            innerOverflow: chartNode.scrollWidth - chartNode.clientWidth,
          }
        : null;

      const canvas = document.querySelector("[data-map-canvas]");
      const map = box(canvas);
      const mapHeading = byId("peta-judul");
      const donut = box(document.querySelector("[data-theme-donut]"));
      const legend = box(
        document.querySelector(
          '#tema-konten [role="region"][aria-label^="Legenda tema"]',
        ),
      );
      const themeCard = box(document.querySelector("[data-theme-card]"));

      const overlaps = [];
      function check(name, left, right) {
        if (!left || !right) return;
        if (
          left.left < right.right &&
          right.left < left.right &&
          left.top < right.bottom &&
          right.top < left.bottom
        ) {
          overlaps.push(name);
        }
      }
      for (let index = 0; index < panelIds.length; index += 1) {
        for (let other = index + 1; other < panelIds.length; other += 1) {
          check(
            `${panelIds[index]}-${panelIds[other]}`,
            boxes[panelIds[index]],
            boxes[panelIds[other]],
          );
        }
      }
      check("pilih-cabang-fkrtl", byId("pilih-cabang"), byId("fkrtl"));
      check("pilih-cabang-fktp", byId("pilih-cabang"), byId("fktp"));
      check("ringkasan-grafik", byId("ringkasan"), byId("konten-per-cabang"));
      check("stakeholder-peta", byId("stakeholder"), byId("peta"));
      check("peta-tema", byId("peta"), byId("tema-konten"));
      check("judul-peta-kanvas", mapHeading, map);
      check("donut-legenda", donut, legend);
      check("edufast-non-edufast", byId("edufast"), byId("non-edufast"));
      check("skor-tema-kartu", byId("non-edufast"), themeCard);

      const tracks = [...document.querySelectorAll("[data-ranking-track]")].map(
        (track) => track.getBoundingClientRect().height,
      );

      const chartEmpty = document
        .getElementById("konten-per-cabang")
        ?.textContent?.includes("Belum ada cabang dalam cakupan Anda.");
      const mapEmpty = document
        .getElementById("peta")
        ?.textContent?.includes("Belum ada konten tervalidasi dengan lokasi");
      const themeEmpty = document
        .getElementById("tema-konten")
        ?.textContent?.includes("Belum ada konten Non-EDUFAST");

      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        boxes,
        gaps,
        chart,
        chartEmpty: Boolean(chartEmpty),
        map: map
          ? {
              ...map,
              headingAbove:
                mapHeading !== null && mapHeading.bottom <= map.top + 1,
            }
          : null,
        mapEmpty: Boolean(mapEmpty),
        donut,
        legend,
        themeEmpty: Boolean(themeEmpty),
        barH: tracks.length > 0 ? Math.min(...tracks) : null,
        overlaps,
      };
    },
    {
      gapPairs: GAP_PAIRS,
      panelIds: ["fkrtl", "fktp", "pemda", "stakeholder"],
    },
  );
}

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
          let mapState = "empty";
          if ((await page.locator("[data-map-canvas]").count()) > 0) {
            mapState = "loading";
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
              mapState = mapFailed === 0 ? "ready" : "failed";
            } catch {
              mapState = "failed";
            }
          } else {
            mapState = (await page
              .locator("#peta")
              .getByText("Belum ada konten tervalidasi dengan lokasi", {
                exact: false,
              })
              .count())
              ? "empty"
              : "failed";
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(1200);

          const missing = await page.evaluate(
            (ids) => ids.filter((id) => !document.getElementById(id)),
            SECTIONS,
          );
          const pageHeight = await page.evaluate(
            () => document.documentElement.scrollHeight,
          );
          const layout = await measureLayout(page);
          const limits = LAYOUT_LIMITS[viewport.name];
          const layoutOk =
            layout.overflow <= 1 &&
            layout.overlaps.length === 0 &&
            layout.gaps.every((gap) => gap.gap !== null && gap.gap >= 8) &&
            (layout.chart
              ? layout.chart.width >= limits.chartWidth &&
                layout.chart.height >= 180 &&
                layout.chart.svg &&
                layout.chart.innerOverflow <= 1
              : layout.chartEmpty) &&
            (layout.map
              ? layout.map.width >= limits.mapWidth &&
                layout.map.height >= limits.mapHeight &&
                layout.map.headingAbove
              : layout.mapEmpty) &&
            (layout.donut
              ? layout.donut.width >= 210 && layout.donut.height >= 210
              : layout.themeEmpty) &&
            (layout.barH === null || layout.barH >= 5);

          const screenshot = join(outDir, `${role.name}-${viewport.name}.png`);
          await page.screenshot({ path: screenshot, fullPage: true });

          const minGap = Math.min(...layout.gaps.map((gap) => gap.gap ?? -1));
          results.push({
            role: role.name,
            path: role.path,
            viewport: viewport.name,
            screenshot,
            mapState,
            mapReady: mapState === "ready",
            missingSections: missing,
            horizontalOverflowPx: Math.max(0, layout.overflow),
            pageHeight,
            layout: {
              chartW: layout.chart?.width ?? null,
              chartH: layout.chart?.height ?? null,
              mapW: layout.map?.width ?? null,
              mapH: layout.map?.height ?? null,
              panelW: Math.min(
                ...["fkrtl", "fktp", "pemda", "stakeholder"].map(
                  (id) => layout.boxes[id]?.width ?? 0,
                ),
              ),
              donut: layout.donut?.width ?? null,
              barH: layout.barH,
              minGap,
              overlaps: layout.overlaps,
            },
            consoleErrors,
            pageErrors,
            ok:
              missing.length === 0 &&
              mapState !== "failed" &&
              pageErrors.length === 0 &&
              layoutOk,
          });
          console.log(
            `${role.name} ${viewport.name}: ${missing.length === 0 ? "section lengkap" : `hilang ${missing.join(", ")}`}, peta ${mapState}, overflow ${Math.max(0, layout.overflow)}px, grafik ${layout.chart ? `${Math.round(layout.chart.width)}x${Math.round(layout.chart.height)}` : "kosong"}, peta ${layout.map ? `${Math.round(layout.map.width)}x${Math.round(layout.map.height)}` : "kosong"}, gap min ${minGap}px, overlap ${layout.overlaps.length}, tinggi ${pageHeight}px, ${pageErrors.length} page error.`,
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
