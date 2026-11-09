/**
 * Sitewide UI/UX quality audit for every role and route.
 *
 * Measures the v3.6 spacing gates (section/card/panel/heading/micro), chart,
 * map, and donut proportions, header action alignment, touch targets, clipped
 * text, overflow, and overlaps at 1440x900, 768x1024, and 375x812. Requires
 * `e2e/.auth/*.json` sessions from the E2E setup and an already-running server.
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:3400 node scripts/ui-quality-audit.mjs
 *   AUDIT_OUT=docs/audit/evidence/ui-v35/baseline.json AUDIT_MODE=baseline \
 *     node scripts/ui-quality-audit.mjs
 *
 * `AUDIT_MODE=baseline` never fails the process. Otherwise every violation not
 * present in `AUDIT_BASELINE` is reported as [NEW] and fails the run.
 *
 * `AUDIT_ROLES=master,regional` and `AUDIT_PATHS=/admin,/client` restrict a
 * phase audit to the pages that phase touched.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import { chromium } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://localhost:${process.env.E2E_PORT ?? "3400"}`;
const mode = process.env.AUDIT_MODE === "baseline" ? "baseline" : "gate";
const outFile =
  process.env.AUDIT_OUT ??
  join("docs", "audit", "evidence", "ui-v36", "audit.json");
const baselineFile = process.env.AUDIT_BASELINE ?? null;
const outDir = dirname(outFile);
const screenshotDir = join(outDir, "screenshots");

const roleFilter = (process.env.AUDIT_ROLES ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const pathFilter = (process.env.AUDIT_PATHS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900, tablet: false },
  { name: "768", width: 768, height: 1024, tablet: true },
  { name: "375", width: 375, height: 812, tablet: false },
];

const ROLES = [
  {
    name: "master",
    state: "admin.json",
    routes: [
      "/admin",
      "/admin/validasi",
      "/admin/laporan",
      "/admin/konten",
      "/admin/konten/impor",
      "/admin/red-notice",
      "/admin/notifikasi",
      "/admin/wilayah",
      "/admin/edufast",
      "/admin/impor",
      "/admin/akun",
      "/admin/peta",
      "/admin/target",
      "/admin/audit",
      "/admin/sinkronisasi",
      "/admin/analitik",
      "/admin/kinerja",
      "/admin/sla",
      "/admin/cabang",
      "/admin/organisasi",
      "/admin/pengguna",
      "/admin/stakeholder",
    ],
    details: [
      { list: "/admin/validasi", pattern: /^\/admin\/validasi\/[^/]+$/ },
    ],
  },
  {
    name: "regional",
    state: "regional.json",
    routes: [
      "/wilayah/dashboard",
      "/wilayah",
      "/wilayah/kinerja",
      "/wilayah/konten",
      "/wilayah/red-notice",
      "/wilayah/notifikasi",
      "/wilayah/cabang",
      "/wilayah/analitik",
      "/wilayah/laporan",
      "/wilayah/organisasi",
      "/wilayah/peta",
      "/wilayah/sla",
    ],
    details: [
      { list: "/wilayah/konten", pattern: /^\/wilayah\/konten\/[^/]+$/ },
    ],
  },
  {
    name: "branch",
    state: "branch-a1.json",
    routes: [
      "/cabang/dashboard",
      "/cabang",
      "/cabang/kinerja",
      "/cabang/konten",
      "/cabang/review",
      "/cabang/red-notice",
      "/cabang/notifikasi",
      "/cabang/analitik",
      "/cabang/laporan",
      "/cabang/organisasi",
      "/cabang/peta",
      "/cabang/sla",
    ],
    details: [
      { list: "/cabang/konten", pattern: /^\/cabang\/konten\/[^/]+$/ },
      { list: "/cabang/review", pattern: /^\/cabang\/review\/[^/]+$/ },
    ],
  },
  {
    name: "stakeholder",
    state: "client.json",
    routes: [
      "/client",
      "/client/konten",
      "/client/lapor",
      "/client/notifikasi",
      "/client/profil",
      "/client/analitik",
    ],
    details: [{ list: "/client/konten", pattern: /^\/client\/konten\/[^/]+$/ }],
  },
];

const TABLET_ROUTES = new Set([
  "/admin",
  "/admin/konten",
  "/admin/target",
  "/admin/validasi",
  "/admin/wilayah",
  "/wilayah/dashboard",
  "/wilayah",
  "/cabang/dashboard",
  "/cabang",
  "/client",
  "/client/konten",
]);

const DASHBOARD_ROUTES = new Set([
  "/admin",
  "/wilayah/dashboard",
  "/cabang/dashboard",
  "/client",
]);

const FORM_ROUTES = new Set([
  "/admin/akun",
  "/admin/konten/impor",
  "/admin/impor",
  "/admin/target",
  "/client/lapor",
]);

function pageType(path, isDetail = false) {
  if (isDetail) return "detail";
  if (DASHBOARD_ROUTES.has(path)) return "dashboard";
  if (FORM_ROUTES.has(path)) return "form";
  return "table";
}

const BANDS = {
  sectionGap: [20, 32],
  cardGap: [12, 20],
  panelPadding: [16, 24],
  chartHeight: [140, 380],
  barThickness: [10, 16],
  columnWidth: [14, 32],
  rankingTrack: [6, 8],
  mapHeight: [260, 360],
  donut: [210, 240],
  buttonHeight: [36, 40],
  mobileTouch: [40, null],
  overflow: [0, 1],
};

function inBand(value, [min, max]) {
  if (value === null || value === undefined) return null;
  return value >= min && (max === null || value <= max);
}

function describeBand([min, max]) {
  return max === null ? `>= ${min}px` : `${min}-${max}px`;
}

function worstBarCheck(barCharts) {
  const checks = (barCharts ?? []).flatMap((chart) => {
    if (!chart || chart.width == null || chart.height == null) return [];
    // Uniform widths with varying heights identify vertical column charts;
    // uniform heights identify horizontal ranking bars. Varying values change
    // a segment's height, never the column's width.
    const constantWidth = chart.widthRange != null && chart.widthRange <= 0.5;
    const constantHeight =
      chart.heightRange != null && chart.heightRange <= 0.5;
    const isColumn =
      constantWidth || (!constantHeight && chart.width <= chart.height);
    return [
      {
        thickness: isColumn ? chart.width : chart.height,
        band: isColumn ? BANDS.columnWidth : BANDS.barThickness,
        kind: isColumn ? "column" : "bar",
      },
    ];
  });
  if (checks.length === 0) return null;
  const deviation = (check) => {
    const [min, max] = check.band;
    if (check.thickness < min) return min - check.thickness;
    if (max !== null && check.thickness > max) return check.thickness - max;
    return 0;
  };
  return checks.reduce(
    (worst, check) => (deviation(check) > deviation(worst) ? check : worst),
    checks[0],
  );
}

async function discoverDetail(context, listPath, pattern) {
  const page = await context.newPage();
  try {
    const response = await page.goto(`${baseURL}${listPath}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    if (!response || response.status() >= 400) return null;
    await page.locator("main").waitFor({ state: "visible", timeout: 60_000 });
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")].map((anchor) =>
        anchor.getAttribute("href"),
      ),
    );
    return hrefs.find((href) => href && pattern.test(href)) ?? null;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const container = document.querySelector("[data-page-container]");
    const header = document.querySelector("[data-page-header]");
    const actions = document.querySelector("[data-page-header-actions]");
    const meta = document.querySelector("[data-page-header-meta]");

    function box(node) {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      return {
        left: rect.left,
        top: rect.top + window.scrollY,
        right: rect.right,
        bottom: rect.bottom + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
    }
    function visible(node) {
      const style = window.getComputedStyle(node);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        node.getBoundingClientRect().height > 0
      );
    }
    function selectorOf(node) {
      if (!node) return null;
      if (node.id) return `#${node.id}`;
      const dataAttr = [...node.attributes].find((attribute) =>
        attribute.name.startsWith("data-"),
      );
      if (dataAttr) return `[${dataAttr.name}]`;
      const className =
        typeof node.className === "string"
          ? node.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      return node.tagName.toLowerCase() + (className ? `.${className}` : "");
    }
    function gapsBetween(boxes) {
      const gaps = [];
      for (let index = 0; index < boxes.length - 1; index += 1) {
        const current = boxes[index];
        const next = boxes[index + 1];
        if (!current || !next) continue;
        if (next.top < current.top) continue;
        gaps.push(Math.round((next.top - current.bottom) * 10) / 10);
      }
      return gaps;
    }
    function overlap(label, left, right) {
      if (!left || !right) return null;
      const intersects =
        left.left < right.right - 0.5 &&
        right.left < left.right - 0.5 &&
        left.top < right.bottom - 0.5 &&
        right.top < left.bottom - 0.5;
      return intersects ? label : null;
    }

    const containerNode = container ?? main;
    const blockNodes = containerNode
      ? [...containerNode.children].filter(visible)
      : [];
    const blocks = blockNodes.map(box);
    const blockGaps = gapsBetween(blocks);

    const gridGaps = [];
    if (main) {
      for (const node of main.querySelectorAll("*")) {
        const style = window.getComputedStyle(node);
        if (style.display !== "grid") continue;
        const children = [...node.children].filter(visible);
        if (children.length < 2) continue;
        const rowGap = Number.parseFloat(style.rowGap);
        const columnGap = Number.parseFloat(style.columnGap);
        if (Number.isFinite(rowGap) && rowGap > 0) {
          gridGaps.push({ kind: "row", value: rowGap });
        }
        if (Number.isFinite(columnGap) && columnGap > 0) {
          gridGaps.push({ kind: "column", value: columnGap });
        }
      }
    }

    const panels = [...document.querySelectorAll("[data-dashboard-panel]")]
      .filter(visible)
      .map((node) => {
        const style = window.getComputedStyle(node);
        return {
          selector: selectorOf(node),
          bleed: node.getAttribute("data-dashboard-panel") === "bleed",
          ...box(node),
          padding: [
            Number.parseFloat(style.paddingTop),
            Number.parseFloat(style.paddingRight),
            Number.parseFloat(style.paddingBottom),
            Number.parseFloat(style.paddingLeft),
          ],
        };
      });

    const chartNodes = [
      ...document.querySelectorAll(".recharts-wrapper"),
    ].filter(visible);
    const chart = chartNodes.length > 0 ? box(chartNodes[0]) : null;
    const median = (values) => {
      if (values.length === 0) return null;
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    // Per chart: stacked column segments have value-dependent heights, so the
    // column width is the bar thickness there; horizontal ranking bars use
    // their height. Keep raw medians and decide outside the page context.
    const barCharts = chartNodes
      .map((wrapper) => {
        const rects = [
          ...wrapper.querySelectorAll(".recharts-bar-rectangle path"),
        ]
          .map((node) => box(node))
          .filter(Boolean);
        if (rects.length === 0) return null;
        const widths = rects.map((rect) => rect.width);
        const heights = rects.map((rect) => rect.height);
        const range = (values) => Math.max(...values) - Math.min(...values);
        return {
          width: median(widths),
          height: median(heights),
          widthRange: range(widths),
          heightRange: range(heights),
        };
      })
      .filter(Boolean);

    const mapCanvas = box(document.querySelector("[data-map-canvas]"));
    const donut = box(document.querySelector("[data-theme-donut]"));
    const rankingTracks = [...document.querySelectorAll("[data-ranking-track]")]
      .map((node) => box(node))
      .filter(Boolean);

    let clippedText = 0;
    let clippedExample = null;
    if (main) {
      for (const node of main.querySelectorAll("*")) {
        if (!(node instanceof HTMLElement)) continue;
        if (/^(svg|canvas|img|input|textarea|select)$/i.test(node.tagName)) {
          continue;
        }
        // Visually hidden helpers clip by design; they never render text.
        if (node.closest(".sr-only")) continue;
        if (node.scrollWidth <= node.clientWidth + 1) continue;
        if (node.clientWidth === 0) continue;
        const style = window.getComputedStyle(node);
        if (style.textOverflow === "ellipsis") continue;
        // Deliberate scroll containers (tables, code blocks) clip by design and
        // remain fully readable by scrolling; the plan allows table overflow.
        if (style.overflowX === "auto" || style.overflowX === "scroll") {
          continue;
        }
        if (style.overflowX === "visible") continue;
        clippedText += 1;
        clippedExample ??= selectorOf(node);
      }
    }

    const actionButtons = actions
      ? [...actions.querySelectorAll("button, a")]
          .filter(visible)
          .map((node) => ({
            selector: selectorOf(node),
            ...box(node),
          }))
      : [];

    const headerBox = box(header);
    const actionsBox = box(actions);
    const metaBox = box(meta);
    const titleBox = header ? box(header.querySelector("h1")) : null;

    const overlaps = [
      overlap("judul-aksi", titleBox, actionsBox),
      overlap("aksi-meta", actionsBox, metaBox),
      overlap("judul-meta", titleBox, metaBox),
    ].filter(Boolean);
    for (let index = 0; index < blocks.length; index += 1) {
      for (let other = index + 1; other < blocks.length; other += 1) {
        const hit = overlap(
          `blok-${index + 1}-blok-${other + 1}`,
          blocks[index],
          blocks[other],
        );
        if (hit) overlaps.push(hit);
      }
    }
    for (let index = 0; index < panels.length; index += 1) {
      for (let other = index + 1; other < panels.length; other += 1) {
        const hit = overlap(
          `${panels[index].selector}-${panels[other].selector}`,
          panels[index],
          panels[other],
        );
        if (hit) overlaps.push(hit);
      }
    }

    return {
      overflow: Math.max(
        0,
        document.documentElement.scrollWidth - window.innerWidth,
      ),
      blockGaps,
      gridGaps,
      panels,
      chart,
      barCharts,
      map: mapCanvas,
      donut,
      rankingTrack: rankingTracks.length
        ? Math.min(...rankingTracks.map((track) => track.height))
        : null,
      clippedText,
      clippedExample,
      overlaps,
      header: headerBox,
      actions: actionsBox,
      meta: metaBox,
      title: titleBox,
      actionButtons,
      pageHeight: document.documentElement.scrollHeight,
    };
  });
}

function evaluate(result, viewport) {
  const { type } = result;
  const metrics = result.metrics;
  const violations = [];
  const push = (code, message, selector, rect, band) => {
    violations.push({ code, message, selector, rect: rect ?? null, band });
  };

  if (metrics.overflow > BANDS.overflow[1]) {
    push(
      "overflow-x",
      `Halaman meluber horizontal ${metrics.overflow}px.`,
      "html",
      null,
      describeBand(BANDS.overflow),
    );
  }
  if (metrics.clippedText > 0) {
    push(
      "text-clip",
      `${metrics.clippedText} elemen memotong teks (contoh ${metrics.clippedExample}).`,
      metrics.clippedExample,
      null,
      "0",
    );
  }
  for (const name of metrics.overlaps) {
    push("overlap", `Elemen bertumpang tindih: ${name}.`, name, null, "0");
  }

  if (viewport.width >= 768 && metrics.actions && metrics.header) {
    const aligned = Math.abs(metrics.actions.right - metrics.header.right) <= 2;
    if (!aligned) {
      push(
        "header-actions-right",
        `Aksi header tidak rata kanan (selisih ${Math.round(
          metrics.header.right - metrics.actions.right,
        )}px).`,
        "[data-page-header-actions]",
        metrics.actions,
        "<= 2px dari tepi kanan",
      );
    }
    if (metrics.meta && metrics.actions) {
      const stacked =
        metrics.meta.top >= metrics.actions.bottom - 1 &&
        Math.abs(metrics.meta.right - metrics.header.right) <= 2;
      if (!stacked) {
        push(
          "header-meta-stack",
          "Meta header tidak berada di bawah aksi, rata kanan.",
          "[data-page-header-meta]",
          metrics.meta,
          "di bawah aksi",
        );
      }
    }
  }

  for (const button of metrics.actionButtons) {
    if (viewport.name === "375") {
      if (!inBand(button.height, BANDS.mobileTouch)) {
        push(
          "touch-target",
          `Target sentuh ${Math.round(button.height)}px < 40px.`,
          button.selector,
          button,
          describeBand(BANDS.mobileTouch),
        );
      }
    } else if (!inBand(button.height, BANDS.buttonHeight)) {
      push(
        "button-height",
        `Tinggi tombol ${Math.round(button.height)}px di luar 36-40px.`,
        button.selector,
        button,
        describeBand(BANDS.buttonHeight),
      );
    }
  }

  if (type === "dashboard" && viewport.width >= 768) {
    const sectionGaps = metrics.blockGaps.filter((gap) => gap > 0);
    for (const gap of sectionGaps) {
      if (!inBand(gap, BANDS.sectionGap)) {
        push(
          "section-gap",
          `Jarak antar section ${gap}px di luar 20-32px.`,
          "[data-page-container]",
          null,
          describeBand(BANDS.sectionGap),
        );
        break;
      }
    }
    const cardGaps = metrics.gridGaps.filter((gap) => gap.value >= 4);
    const outOfBand = cardGaps.find((gap) => !inBand(gap.value, BANDS.cardGap));
    if (outOfBand) {
      push(
        "card-gap",
        `Gap grid ${outOfBand.kind} ${outOfBand.value}px di luar 12-20px.`,
        "grid",
        null,
        describeBand(BANDS.cardGap),
      );
    }
    for (const panel of metrics.panels) {
      if (panel.bleed) continue;
      for (const padding of panel.padding) {
        if (!inBand(padding, BANDS.panelPadding)) {
          push(
            "panel-padding",
            `Padding panel ${padding}px di luar 16-24px.`,
            panel.selector,
            panel,
            describeBand(BANDS.panelPadding),
          );
          break;
        }
      }
    }
    if (metrics.chart) {
      if (!inBand(metrics.chart.height, BANDS.chartHeight)) {
        push(
          "chart-height",
          `Tinggi chart ${Math.round(metrics.chart.height)}px di luar 140-380px.`,
          ".recharts-wrapper",
          metrics.chart,
          describeBand(BANDS.chartHeight),
        );
      }
      const barCheck = worstBarCheck(metrics.barCharts);
      if (barCheck) {
        if (!inBand(barCheck.thickness, barCheck.band)) {
          const label =
            barCheck.kind === "column" ? "Lebar kolom" : "Tebal bar";
          push(
            "bar-thickness",
            `${label} ${barCheck.thickness.toFixed(1)}px di luar ${describeBand(barCheck.band)}.`,
            ".recharts-bar-rectangle",
            null,
            describeBand(barCheck.band),
          );
        }
        metrics.barThickness = barCheck.thickness;
      }
    }
    if (metrics.map && !inBand(metrics.map.height, BANDS.mapHeight)) {
      push(
        "map-height",
        `Tinggi peta ${Math.round(metrics.map.height)}px di luar 260-360px.`,
        "[data-map-canvas]",
        metrics.map,
        describeBand(BANDS.mapHeight),
      );
    }
    if (metrics.donut && !inBand(metrics.donut.height, BANDS.donut)) {
      push(
        "donut-size",
        `Donut ${Math.round(metrics.donut.height)}px di luar 210-240px.`,
        "[data-theme-donut]",
        metrics.donut,
        describeBand(BANDS.donut),
      );
    }
    if (
      metrics.rankingTrack !== null &&
      !inBand(metrics.rankingTrack, BANDS.rankingTrack)
    ) {
      push(
        "ranking-track",
        `Track ranking ${metrics.rankingTrack}px di luar 6-8px.`,
        "[data-ranking-track]",
        null,
        describeBand(BANDS.rankingTrack),
      );
    }
  }

  return violations;
}

function violationKey(role, path, viewport, violation) {
  return [role, path, viewport, violation.code, violation.selector].join("|");
}

async function loadBaseline() {
  if (!baselineFile) return new Set();
  try {
    const raw = JSON.parse(await readFile(baselineFile, "utf8"));
    const keys = new Set();
    for (const result of raw.results ?? []) {
      for (const violation of result.violations ?? []) {
        keys.add(
          violationKey(result.role, result.path, result.viewport, violation),
        );
      }
    }
    return keys;
  } catch {
    return new Set();
  }
}

/**
 * Legacy alias routes finish with a client-side navigation that can destroy the
 * execution context mid-measure; retry once instead of losing the page.
 */
async function measureStable(page) {
  const attempt = async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    return measure(page);
  };
  try {
    return await attempt();
  } catch (error) {
    if (!String(error).includes("Execution context was destroyed")) throw error;
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await settle(page);
    return attempt();
  }
}

/**
 * Legacy aliases can chain two client redirects (`/admin/stakeholder` →
 * `/admin/organisasi` → `/admin/wilayah`). Wait until the URL stops moving so
 * measurement always happens on the final page.
 */
async function settle(page) {
  const startedAt = Date.now();
  let last = page.url();
  let stableSince = Date.now();
  while (Date.now() - startedAt < 10_000) {
    await page.waitForTimeout(250);
    const current = page.url();
    if (current !== last) {
      last = current;
      stableSince = Date.now();
      continue;
    }
    if (Date.now() - stableSince >= 750) return;
  }
}

async function closePageSafely(page) {
  try {
    await Promise.race([
      page.close({ runBeforeUnload: false }),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  } catch {
    // A stuck renderer must not block the remaining routes.
  }
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });
  const baseline = await loadBaseline();
  const browser = await chromium.launch();
  const results = [];

  try {
    for (const role of ROLES) {
      if (roleFilter.length > 0 && !roleFilter.includes(role.name)) continue;
      const context = await browser.newContext({
        storageState: join("e2e", ".auth", role.state),
      });
      const discovered = [];
      for (const detail of role.details) {
        const href = await discoverDetail(context, detail.list, detail.pattern);
        if (href) discovered.push(href);
      }
      const routes = [...role.routes, ...discovered]
        .filter((path) => pathFilter.length === 0 || pathFilter.includes(path))
        .map((path) => ({
          path,
          type: pageType(path, discovered.includes(path)),
          tablet: TABLET_ROUTES.has(path),
          detail: discovered.includes(path),
        }));

      try {
        for (const route of routes) {
          for (const viewport of VIEWPORTS) {
            if (viewport.tablet && !route.tablet) continue;
            const page = await context.newPage();
            await page.setViewportSize({
              width: viewport.width,
              height: viewport.height,
            });
            const pageErrors = [];
            page.on("pageerror", (error) => pageErrors.push(error.message));
            const startedAt = Date.now();
            let settled = false;
            let watchdogTimer;
            const attempt = async () => {
              const response = await page.goto(`${baseURL}${route.path}`, {
                waitUntil: "domcontentloaded",
                timeout: 90_000,
              });
              if (!response || response.status() >= 400) {
                throw new Error(
                  `HTTP ${response?.status() ?? "tanpa respons"}`,
                );
              }
              await page.locator("main").waitFor({
                state: "visible",
                timeout: 90_000,
              });
              if (page.url().includes("/masuk")) {
                throw new Error("Sesi E2E tidak valid (dialihkan ke /masuk)");
              }
              await settle(page);
              await page.locator("main").waitFor({
                state: "visible",
                timeout: 30_000,
              });
              await page.waitForTimeout(300);
              const metrics = await measureStable(page);
              if (settled) return;
              const intermediate = {
                role: role.name,
                path: route.path,
                type: route.type,
                detail: route.detail,
                viewport: viewport.name,
                metrics,
              };
              const violations = evaluate(intermediate, viewport).map(
                (violation) => ({
                  ...violation,
                  status: baseline.has(
                    violationKey(
                      role.name,
                      route.path,
                      viewport.name,
                      violation,
                    ),
                  )
                    ? "existing"
                    : mode === "baseline"
                      ? "baseline"
                      : "[NEW]",
                }),
              );

              const slug = route.path
                .replace(/[^\w]+/g, "-")
                .replace(/^-|-$/g, "");
              const screenshot = join(
                screenshotDir,
                `${role.name}-${slug}-${viewport.name}.png`,
              );
              // Multi-thousand-row pages can make full-page capture enormous;
              // cap it so the audit cannot stall on a single screenshot.
              const pageHeight = await page
                .evaluate(() => document.documentElement.scrollHeight)
                .catch(() => 0);
              await page.screenshot({
                path: screenshot,
                fullPage: pageHeight <= 16_000,
                timeout: 45_000,
              });
              if (settled) return;

              const newViolations = violations.filter(
                (violation) => violation.status === "[NEW]",
              );
              settled = true;
              results.push({
                role: role.name,
                path: route.path,
                type: route.type,
                detail: route.detail,
                viewport: viewport.name,
                ok: pageErrors.length === 0 && newViolations.length === 0,
                screenshot: relative(outDir, screenshot).replaceAll("\\", "/"),
                durationMs: Date.now() - startedAt,
                pageErrors,
                violations,
                metrics: {
                  overflowPx: metrics.overflow,
                  pageHeight: metrics.pageHeight,
                  blockGaps: metrics.blockGaps,
                  gridGaps: metrics.gridGaps,
                  chartHeight: metrics.chart?.height ?? null,
                  barThickness: metrics.barThickness,
                  mapHeight: metrics.map?.height ?? null,
                  donutHeight: metrics.donut?.height ?? null,
                  rankingTrack: metrics.rankingTrack,
                  clippedText: metrics.clippedText,
                  overlapCount: metrics.overlaps.length,
                },
              });
              console.log(
                `${role.name} ${route.path} ${viewport.name}: ${violations.length} temuan, overflow ${metrics.overflow}px, ${pageErrors.length} page error, ${Date.now() - startedAt}ms`,
              );
            };

            const watchdog = new Promise((_, reject) => {
              watchdogTimer = setTimeout(
                () =>
                  reject(
                    new Error(
                      "Batas waktu audit 150 dtk per halaman terlampaui",
                    ),
                  ),
                150_000,
              );
            });

            try {
              await Promise.race([attempt(), watchdog]);
            } catch (error) {
              if (!settled) {
                settled = true;
                const failure = {
                  code: "page-error",
                  message:
                    error instanceof Error ? error.message : String(error),
                  selector: null,
                  rect: null,
                  band: null,
                };
                // Legacy aliases flake on the same redirect every run; honour
                // the baseline instead of reporting a permanent [NEW].
                const known = baseline.has(
                  violationKey(role.name, route.path, viewport.name, failure),
                );
                results.push({
                  role: role.name,
                  path: route.path,
                  type: route.type,
                  detail: route.detail,
                  viewport: viewport.name,
                  ok: known,
                  screenshot: null,
                  error: failure.message,
                  pageErrors,
                  violations: [
                    {
                      ...failure,
                      status: known ? "existing" : "[NEW]",
                    },
                  ],
                  metrics: null,
                });
                const label = known ? "existing" : "[NEW]";
                console.error(
                  `${role.name} ${route.path} ${viewport.name}: GAGAL (${label}) — ${failure.message}`,
                );
              }
            } finally {
              clearTimeout(watchdogTimer);
              await closePageSafely(page);
            }
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const allViolations = results.flatMap((result) =>
    (result.violations ?? []).map((violation) => ({
      role: result.role,
      path: result.path,
      viewport: result.viewport,
      ...violation,
    })),
  );
  const statusCount = (status) =>
    allViolations.filter((violation) => violation.status === status).length;
  const failed = results.filter((result) => !result.ok);

  await writeFile(
    outFile,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseURL,
        mode,
        baselineFile,
        viewports: VIEWPORTS.map(({ name, width, height }) => ({
          name,
          width,
          height,
        })),
        bands: BANDS,
        summary: {
          pages: results.length,
          passed: results.length - failed.length,
          failed: failed.length,
          violations: allViolations.length,
          existing: statusCount("existing"),
          baseline: statusCount("baseline"),
          new: statusCount("[NEW]"),
          byCode: allViolations.reduce((counts, violation) => {
            counts[violation.code] = (counts[violation.code] ?? 0) + 1;
            return counts;
          }, {}),
        },
        results,
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `\n${results.length - failed.length}/${results.length} halaman lolos. ` +
      `${allViolations.length} temuan (${statusCount("existing")} existing, ` +
      `${statusCount("baseline")} baseline, ${statusCount("[NEW]")} NEW). ` +
      `Evidence: ${outFile}`,
  );
  if (mode !== "baseline" && failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
