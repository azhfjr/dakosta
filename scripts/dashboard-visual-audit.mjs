/**
 * Dashboard v3.5 role-aware visual audit.
 *
 * Captures the four roles at desktop, tablet, and mobile widths against an
 * already-running local/staging server. Requires `e2e/.auth/*.json` sessions
 * produced by the E2E global setup. Never prints credentials.
 *
 * Gating verifies the v3.5 composition per role (national/regional branch
 * chart, branch institution chart, stakeholder KPI + theme only), proportional
 * charts/map/donut, header actions on the right, spacing bands, equal-height
 * panel pairs, and zero overlaps or clipped labels.
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:3400 node scripts/dashboard-visual-audit.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://localhost:${process.env.E2E_PORT ?? "3400"}`;

const ROLES = [
  {
    name: "master",
    state: "admin.json",
    path: "/admin",
    variant: "national",
    chartId: "konten-per-cabang",
    hasFilter: true,
    hasCollaboration: true,
    sections: [
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
    ],
  },
  {
    name: "regional",
    state: "regional.json",
    path: "/wilayah/dashboard",
    variant: "regional",
    chartId: "konten-per-cabang",
    hasFilter: true,
    hasCollaboration: true,
    sections: [
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
    ],
  },
  {
    name: "branch",
    state: "branch-a1.json",
    path: "/cabang/dashboard",
    variant: "branch",
    chartId: "konten-per-institusi",
    hasFilter: false,
    hasCollaboration: true,
    sections: [
      "ringkasan",
      "konten-per-institusi",
      "kolaborasi",
      "fkrtl",
      "fktp",
      "pemda",
      "stakeholder",
      "peta",
      "tema-konten",
      "edufast",
      "non-edufast",
    ],
  },
  {
    name: "stakeholder",
    state: "client.json",
    path: "/client",
    variant: "stakeholder",
    chartId: null,
    hasFilter: false,
    hasCollaboration: false,
    sections: ["ringkasan", "edufast", "non-edufast", "tema-konten"],
  },
];

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "375", width: 375, height: 812 },
];

const CHART_WIDTH_MIN = { 1440: 1000, 768: 600, 375: 280 };
const MAP_WIDTH_MIN = { 1440: 1000, 768: 600, 375: 280 };

const outDir = join("docs", "audit", "evidence", "dashboard-v35");

function gapPairsFor(role, viewport) {
  if (!role.hasCollaboration) {
    return [["ringkasan", "tema-konten", 20, 32]];
  }
  // Below `sm` the ranking grid stacks into one column, so only consecutive
  // panels are adjacent; measuring fkrtl→pemda there would span a whole panel.
  const rankingPairs =
    viewport.width < 640
      ? [
          ["fkrtl", "fktp", 12, 20],
          ["fktp", "pemda", 12, 20],
          ["pemda", "stakeholder", 12, 20],
        ]
      : [
          ["fkrtl", "pemda", 12, 20],
          ["fktp", "stakeholder", 12, 20],
        ];
  return [
    ["ringkasan", role.chartId, 12, 32],
    [role.chartId, "kolaborasi", 20, 32],
    ...(role.hasFilter ? [["pilih-cabang", "fkrtl", 12, 32]] : []),
    ...rankingPairs,
    ["stakeholder", "peta", 12, 32],
    ["kolaborasi", "tema-konten", 20, 32],
  ];
}

async function measureLayout(page, role, gapPairs) {
  return page.evaluate(
    ({ gapPairs, panelIds, chartId, hasCollaboration }) => {
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

      const gaps = gapPairs.map(([from, to, min, max]) => ({
        from,
        to,
        min,
        max,
        gap:
          boxes[from] && boxes[to] ? boxes[to].top - boxes[from].bottom : null,
      }));

      const headerBox = box(document.querySelector("[data-page-header]"));
      const actionsBox = box(
        document.querySelector("[data-page-header-actions]"),
      );
      const metaBox = box(document.querySelector("[data-page-header-meta]"));
      const actionsNode = document.querySelector("[data-page-header-actions]");
      const actionButtons = actionsNode
        ? [...actionsNode.querySelectorAll("a,button")].map((node) => box(node))
        : [];

      let chart = null;
      let chartEmpty = false;
      if (chartId) {
        const section = document.getElementById(chartId);
        chartEmpty = Boolean(
          section?.textContent?.includes(
            "Belum ada cabang dalam cakupan Anda.",
          ) ||
          section?.textContent?.includes(
            "Belum ada konten tervalidasi pada cabang Anda.",
          ) ||
          section?.textContent?.includes("Belum ada institusi"),
        );
        const chartNode = section?.querySelector(
          '[role="region"][aria-label$="dapat digulir"]',
        );
        if (chartNode) {
          const regionRect = chartNode.getBoundingClientRect();
          const canvas = chartNode.firstElementChild;
          const labels = [
            ...chartNode.querySelectorAll(".recharts-label-list text"),
          ];
          const bars = [
            ...chartNode.querySelectorAll(".recharts-bar-rectangle path"),
          ];
          chart = {
            ...box(chartNode),
            canvasH: canvas ? canvas.getBoundingClientRect().height : null,
            svg: chartNode.querySelector("svg") !== null,
            labels: labels.length,
            labelOverflow: labels.length
              ? Math.max(
                  ...labels.map(
                    (label) =>
                      label.getBoundingClientRect().right - regionRect.right,
                  ),
                )
              : 0,
            barThickness: bars.length
              ? Math.min(
                  ...bars.map((bar) => bar.getBoundingClientRect().height),
                )
              : null,
            innerOverflow: chartNode.scrollWidth - chartNode.clientWidth,
          };
        }
      }

      const mapNode = document.querySelector("[data-map-canvas]");
      const map = mapNode
        ? {
            ...box(mapNode),
            headingAbove:
              (document.getElementById("peta-judul")?.getBoundingClientRect()
                .bottom ?? Number.POSITIVE_INFINITY) <=
              mapNode.getBoundingClientRect().top + 1,
          }
        : null;
      const mapEmpty = hasCollaboration
        ? Boolean(
            document
              .getElementById("peta")
              ?.textContent?.includes(
                "Belum ada konten tervalidasi dengan lokasi",
              ),
          )
        : false;

      const donut = box(document.querySelector("[data-theme-donut]"));
      const legend = box(
        document.querySelector(
          '#tema-konten [role="region"][aria-label^="Legenda tema"]',
        ),
      );
      const themeEmpty = Boolean(
        document
          .getElementById("tema-konten")
          ?.textContent?.includes("Belum ada konten Non-EDUFAST"),
      );

      const overlaps = [];
      function check(name, left, right) {
        if (!left || !right) return;
        if (
          left.left < right.right - 0.5 &&
          right.left < left.right - 0.5 &&
          left.top < right.bottom - 0.5 &&
          right.top < left.bottom - 0.5
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
      if (hasCollaboration) {
        check("pilih-cabang-fkrtl", byId("pilih-cabang"), byId("fkrtl"));
        check("ringkasan-grafik", byId("ringkasan"), byId(chartId));
        check("stakeholder-peta", byId("stakeholder"), byId("peta"));
        check("peta-tema", byId("peta"), byId("tema-konten"));
        check("judul-peta-kanvas", byId("peta-judul"), map);
      }
      check("donut-legenda", donut, legend);
      check("edufast-non-edufast", byId("edufast"), byId("non-edufast"));

      const tracks = [...document.querySelectorAll("[data-ranking-track]")].map(
        (track) => track.getBoundingClientRect().height,
      );

      const panelRows = [
        ["fkrtl", "fktp"],
        ["pemda", "stakeholder"],
      ].map(([leftId, rightId]) => ({
        left: boxes[leftId] ?? null,
        right: boxes[rightId] ?? null,
      }));

      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        boxes,
        gaps,
        header: headerBox,
        actions: actionsBox,
        meta: metaBox,
        actionButtons,
        chart,
        chartEmpty,
        map,
        mapEmpty,
        donut,
        legend,
        themeEmpty,
        rankingTrackMin: tracks.length > 0 ? Math.min(...tracks) : null,
        rankingTrackMax: tracks.length > 0 ? Math.max(...tracks) : null,
        panelRows,
        overlaps,
      };
    },
    {
      gapPairs,
      panelIds: ["fkrtl", "fktp", "pemda", "stakeholder"],
      chartId: role.chartId,
      hasCollaboration: role.hasCollaboration,
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
        const gapPairs = gapPairsFor(role, viewport);
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
          if (role.chartId) {
            await page.locator(`#${role.chartId}`).waitFor({
              state: "visible",
              timeout: 120_000,
            });
          }
          let mapState = "not-applicable";
          if (role.hasCollaboration) {
            await page.locator("#peta").scrollIntoViewIfNeeded();
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
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(1200);

          const missing = await page.evaluate(
            (ids) => ids.filter((id) => !document.getElementById(id)),
            role.sections,
          );
          const pageHeight = await page.evaluate(
            () => document.documentElement.scrollHeight,
          );
          const layout = await measureLayout(page, role, gapPairs);

          const gapViolations = layout.gaps.filter((gap) => {
            if (gap.gap === null) return true;
            return gap.gap < gap.min - 0.5 || gap.gap > gap.max + 0.5;
          });
          const headerOk =
            viewport.width < 768
              ? layout.actions &&
                layout.header &&
                Math.abs(layout.actions.left - layout.header.left) <= 2
              : layout.actions &&
                layout.header &&
                Math.abs(layout.actions.right - layout.header.right) <= 2 &&
                layout.meta &&
                layout.meta.top >= layout.actions.bottom - 1;
          const buttonsOk = layout.actionButtons.every((button) => {
            if (!button) return false;
            return viewport.name === "375"
              ? button.height >= 39
              : button.height >= 35 && button.height <= 41;
          });
          const chartOk = role.chartId
            ? layout.chart
              ? layout.chart.width >= CHART_WIDTH_MIN[viewport.name] &&
                layout.chart.height >= 158 &&
                layout.chart.height <= 362 &&
                (layout.chart.canvasH === null ||
                  (layout.chart.canvasH >= 159 &&
                    layout.chart.canvasH <= 380)) &&
                layout.chart.svg &&
                layout.chart.innerOverflow <= 1 &&
                layout.chart.labels > 0 &&
                layout.chart.labelOverflow <= 1.5 &&
                (layout.chart.barThickness === null ||
                  (layout.chart.barThickness >= 10 &&
                    layout.chart.barThickness <= 16))
              : layout.chartEmpty
            : layout.chart === null;
          const mapOk = !role.hasCollaboration
            ? layout.map === null
            : layout.map
              ? layout.map.width >= MAP_WIDTH_MIN[viewport.name] &&
                layout.map.height >= 258 &&
                layout.map.height <= 342 &&
                layout.map.headingAbove
              : layout.mapEmpty;
          const themeOk = layout.donut
            ? layout.donut.width >= 210 &&
              layout.donut.height >= 210 &&
              layout.donut.height <= 240 &&
              (!layout.legend ||
                layout.legend.height <= layout.donut.height + 1)
            : layout.themeEmpty;
          const rankingOk = role.hasCollaboration
            ? layout.rankingTrackMin !== null &&
              layout.rankingTrackMin >= 5.5 &&
              layout.rankingTrackMax <= 8.5
            : layout.rankingTrackMin === null;
          const panelRowsOk =
            viewport.width < 768 ||
            !role.hasCollaboration ||
            layout.panelRows.every(
              ({ left, right }) =>
                !left ||
                !right ||
                (Math.abs(left.top - right.top) <= 2 &&
                  Math.abs(left.height - right.height) <= 2),
            );

          const layoutOk =
            layout.overflow <= 1 &&
            layout.overlaps.length === 0 &&
            gapViolations.length === 0 &&
            headerOk &&
            buttonsOk &&
            chartOk &&
            mapOk &&
            themeOk &&
            rankingOk &&
            panelRowsOk;

          const screenshot = join(outDir, `${role.name}-${viewport.name}.png`);
          await page.screenshot({
            path: screenshot,
            fullPage: pageHeight <= 16_000,
          });

          results.push({
            role: role.name,
            variant: role.variant,
            path: role.path,
            viewport: viewport.name,
            screenshot,
            mapState,
            mapReady: mapState === "ready" || mapState === "not-applicable",
            missingSections: missing,
            horizontalOverflowPx: Math.max(0, layout.overflow),
            pageHeight,
            layout: {
              chartW: layout.chart?.width ?? null,
              chartH: layout.chart?.height ?? null,
              chartLabels: layout.chart?.labels ?? null,
              chartBarThickness: layout.chart?.barThickness ?? null,
              chartLabelOverflow: layout.chart?.labelOverflow ?? null,
              mapW: layout.map?.width ?? null,
              mapH: layout.map?.height ?? null,
              donut: layout.donut?.height ?? null,
              rankingTrack: layout.rankingTrackMin,
              gaps: layout.gaps.map((gap) => ({
                pair: `${gap.from}→${gap.to}`,
                gap: gap.gap,
                band: [gap.min, gap.max],
              })),
              overlaps: layout.overlaps,
              headerRightAligned: headerOk,
              panelRowsOk,
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
            `${role.name} ${viewport.name}: ${
              missing.length === 0
                ? "section lengkap"
                : `hilang ${missing.join(", ")}`
            }, peta ${mapState}, overflow ${Math.max(0, layout.overflow)}px, grafik ${
              layout.chart
                ? `${Math.round(layout.chart.width)}x${Math.round(layout.chart.height)}`
                : "kosong"
            }, peta ${
              layout.map
                ? `${Math.round(layout.map.width)}x${Math.round(layout.map.height)}`
                : "kosong"
            }, gap ${
              gapViolations.length > 0
                ? `LANGAR ${gapViolations
                    .map((gap) => `${gap.from}→${gap.to} ${gap.gap}px`)
                    .join(", ")}`
                : "sesuai band"
            }, overlap ${layout.overlaps.length}, ${layoutOk ? "OK" : "GAGAL GATE"}, ${pageErrors.length} page error.`,
          );
        } catch (error) {
          results.push({
            role: role.name,
            variant: role.variant,
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
