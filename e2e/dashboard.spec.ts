import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

const DASHBOARDS = [
  {
    name: "master",
    path: "/admin",
    state: ADMIN_STATE,
    variant: "national",
    heading: /^Dashboard nasional$/,
    chartId: "konten-per-cabang",
    hasFilter: true,
    hasCollaboration: true,
    kpis: ["Total Konten Tervalidasi", "Cabang dengan Konten"],
    secondaryAction: "Cek SLA",
  },
  {
    name: "regional",
    path: "/wilayah/dashboard",
    state: REGIONAL_STATE,
    variant: "regional",
    heading: /^Dashboard wilayah$/,
    chartId: "konten-per-cabang",
    hasFilter: true,
    hasCollaboration: true,
    kpis: ["Total Konten Tervalidasi", "Cabang dengan Konten"],
    secondaryAction: "Lihat kinerja wilayah",
  },
  {
    name: "branch",
    path: "/cabang/dashboard",
    state: BRANCH_STATE,
    variant: "branch",
    heading: /^Dashboard cabang$/,
    chartId: "konten-per-institusi",
    hasFilter: false,
    hasCollaboration: true,
    kpis: ["Total Konten Tervalidasi", "Institusi dengan Konten"],
    secondaryAction: "Cek SLA cabang",
  },
  {
    name: "stakeholder",
    path: "/client",
    state: CLIENT_STATE,
    variant: "stakeholder",
    heading: /^Beranda /,
    chartId: null,
    hasFilter: false,
    hasCollaboration: false,
    kpis: [
      "Total Konten Tervalidasi",
      "Institusi dengan Konten",
      "Konten EDUFAST",
      "Konten Non-EDUFAST",
    ],
    secondaryAction: "Lapor konten",
  },
] as const;

type DashboardConfig = (typeof DASHBOARDS)[number];

const SECTION_ORDER: Record<string, readonly string[]> = {
  national: [
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
  regional: [
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
  branch: [
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
  stakeholder: ["ringkasan", "edufast", "non-edufast", "tema-konten"],
};

const CATEGORY_SECTIONS = [
  { anchor: "fkrtl", label: "FKRTL" },
  { anchor: "fktp", label: "FKTP" },
  { anchor: "pemda", label: "Pemda" },
  { anchor: "stakeholder", label: "Stakeholder" },
];

const PANEL_IDS = ["fkrtl", "fktp", "pemda", "stakeholder"] as const;

const OUT_OF_SCOPE_BRANCH = "00000000-0000-4000-8000-000000000000";

const GAP_BANDS: Record<string, [number, number]> = {
  "ringkasan→chart": [12, 32],
  "chart→kolaborasi": [20, 32],
  "ringkasan→tema": [20, 32],
  "kolaborasi→tema": [20, 32],
  "filter→fkrtl": [12, 32],
  "fkrtl→pemda": [12, 20],
  "fkrtl→fktp": [12, 20],
  "fktp→pemda": [12, 20],
  "pemda→stakeholder": [12, 20],
  "stakeholder→peta": [12, 32],
  "tema-heading→card": [8, 20],
};

/** Only panels that actually sit next to each other are measured. */
function gapKeysFor(dashboard: DashboardConfig, width: number): string[] {
  if (!dashboard.hasCollaboration) return ["ringkasan→tema"];
  const rankingKeys =
    width < 640
      ? ["fkrtl→fktp", "fktp→pemda", "pemda→stakeholder"]
      : ["fkrtl→pemda"];
  return [
    "ringkasan→chart",
    "chart→kolaborasi",
    ...(dashboard.hasFilter ? ["filter→fkrtl"] : []),
    ...rankingKeys,
    "stakeholder→peta",
    "kolaborasi→tema",
    // Below `lg` the theme scorecards stack above the theme card, so the
    // heading-to-card distance spans a whole card row.
    ...(!dashboard.hasCollaboration || width >= 1024
      ? ["tema-heading→card"]
      : []),
  ];
}

function parseNumber(text: string): number {
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function parsePercent(text: string): number {
  const match = text.match(/([\d.,]+)%/);
  if (!match) throw new Error(`Persentase tidak ditemukan: ${text}`);
  return Number(match[1]!.replace(/\./g, "").replace(",", "."));
}

async function waitForDashboard(
  page: Page,
  dashboard: DashboardConfig,
  path: string = dashboard.path,
): Promise<void> {
  await page.goto(path);
  // The dashboard streams one Suspense boundary per group; wait for the last
  // anchor of each group before reading numbers or interacting.
  await expect(page.locator("#ringkasan")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#tema-konten")).toBeVisible({ timeout: 30_000 });
  if (dashboard.chartId) {
    await expect(page.locator(`#${dashboard.chartId}`)).toBeVisible({
      timeout: 30_000,
    });
  }
  if (dashboard.hasCollaboration) {
    await expect(page.locator("#kolaborasi")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#peta")).toBeVisible({ timeout: 30_000 });
    for (const section of CATEGORY_SECTIONS) {
      await expect(page.locator(`#${section.anchor}`)).toBeVisible({
        timeout: 30_000,
      });
    }
  }
}

async function scoreAt(page: Page, selector: string): Promise<number> {
  return parseNumber(await page.locator(selector).first().innerText());
}

async function openBranchList(page: Page): Promise<void> {
  const details = page.locator("#pilih-cabang details");
  const isOpen = await details.evaluate(
    (node) => (node as HTMLDetailsElement).open,
  );
  if (isOpen) return;
  await page.locator("#pilih-cabang summary").click();
  await expect(details).toHaveJSProperty("open", true);
}

async function sectionDomOrder(
  page: Page,
  ids: readonly string[],
): Promise<string[]> {
  return page.evaluate((sectionIds) => {
    const nodes = sectionIds.map((id) => {
      const node = document.getElementById(id);
      if (!node) throw new Error(`Section #${id} tidak ditemukan`);
      return node;
    });
    return [...nodes]
      .sort((left, right) => (left.compareDocumentPosition(right) & 4 ? -1 : 1))
      .map((node) => node.id);
  }, ids);
}

type LayoutBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type LayoutMetrics = {
  overflow: number;
  containerGap: number | null;
  mainPadding: number | null;
  header: LayoutBox | null;
  actions: LayoutBox | null;
  meta: LayoutBox | null;
  actionHeights: number[];
  actionGap: number | null;
  gaps: { key: string; value: number | null }[];
  panels: Record<string, LayoutBox | null>;
  panelPadding: number | null;
  cardGapX: number | null;
  chart: {
    regionHeight: number;
    canvasHeight: number | null;
    svg: boolean;
    labels: number;
    labelOverflow: number;
    barThickness: number;
    innerOverflow: number;
  } | null;
  map: { height: number } | null;
  donut: { width: number; height: number; legendHeight: number | null } | null;
  ranking: {
    count: number;
    trackMin: number | null;
    trackMax: number | null;
    percents: number;
  };
};

async function layoutMetrics(
  page: Page,
  dashboard: DashboardConfig,
): Promise<LayoutMetrics> {
  const gapKeys = gapKeysFor(dashboard, page.viewportSize()?.width ?? 1440);
  return page.evaluate(
    ({ chartId, hasCollaboration, panelIds, gapKeys }) => {
      const scrollTop = window.scrollY;
      function box(node: Element | null): LayoutBox | null {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top + scrollTop,
          right: rect.right,
          bottom: rect.bottom + scrollTop,
          width: rect.width,
          height: rect.height,
        };
      }
      function gap(from: Element | null, to: Element | null): number | null {
        if (!from || !to) return null;
        return (
          to.getBoundingClientRect().top - from.getBoundingClientRect().bottom
        );
      }

      const header = box(document.querySelector("[data-page-header]"));
      const actionsNode = document.querySelector("[data-page-header-actions]");
      const actions = box(actionsNode);
      const meta = box(document.querySelector("[data-page-header-meta]"));
      const actionButtons = actionsNode
        ? [...actionsNode.querySelectorAll("a,button")]
        : [];
      const actionHeights = actionButtons.map((node) => box(node)!.height);
      const actionGap =
        actionButtons.length > 1
          ? actionButtons[1]!.getBoundingClientRect().left -
            actionButtons[0]!.getBoundingClientRect().right
          : null;

      const container = document.querySelector("[data-page-container]");
      const rowGap = container
        ? Number.parseFloat(getComputedStyle(container).rowGap)
        : Number.NaN;
      const main = document.querySelector("main");
      const mainPadding = main
        ? Number.parseFloat(getComputedStyle(main).paddingLeft)
        : Number.NaN;

      const ringkasan = document.getElementById("ringkasan");
      const chartSection = chartId ? document.getElementById(chartId) : null;
      const kolaborasi = document.getElementById("kolaborasi");
      const pilihCabang = document.getElementById("pilih-cabang");
      const panels = Object.fromEntries(
        panelIds.map((id) => [id, document.getElementById(id)]),
      ) as Record<string, HTMLElement | null>;
      const peta = document.getElementById("peta");
      const tema = document.getElementById("tema-konten");
      const temaHeading = tema?.querySelector("h2") ?? null;
      const temaCard = document.querySelector("[data-theme-card]");

      const nodes: Record<string, [Element | null, Element | null]> = {
        "ringkasan→chart": [ringkasan, chartSection],
        "chart→kolaborasi": [chartSection, kolaborasi],
        "ringkasan→tema": [ringkasan, tema],
        "kolaborasi→tema": [kolaborasi, tema],
        "filter→fkrtl": [pilihCabang, panels.fkrtl ?? null],
        "fkrtl→pemda": [panels.fkrtl ?? null, panels.pemda ?? null],
        "fkrtl→fktp": [panels.fkrtl ?? null, panels.fktp ?? null],
        "fktp→pemda": [panels.fktp ?? null, panels.pemda ?? null],
        "pemda→stakeholder": [panels.pemda ?? null, panels.stakeholder ?? null],
        "stakeholder→peta": [panels.stakeholder ?? null, peta],
        "tema-heading→card": [temaHeading, temaCard],
      };
      const gaps = gapKeys.map((key) => ({
        key,
        value: gap(nodes[key]?.[0] ?? null, nodes[key]?.[1] ?? null),
      }));

      const panelBoxes = Object.fromEntries(
        panelIds.map((id) => [id, box(panels[id])]),
      );
      const firstPanel =
        panels.fkrtl ??
        [...document.querySelectorAll("[data-dashboard-panel]")].find(
          (node) => node.getAttribute("data-dashboard-panel") !== "bleed",
        ) ??
        null;
      const panelPadding = firstPanel
        ? Number.parseFloat(getComputedStyle(firstPanel).paddingLeft)
        : Number.NaN;
      const cardGapX =
        panelBoxes.fktp && panelBoxes.fkrtl
          ? panelBoxes.fktp.left - panelBoxes.fkrtl.right
          : null;

      let chart: LayoutMetrics["chart"] = null;
      const chartRegion = chartSection?.querySelector<HTMLElement>(
        '[role="region"][aria-label$="dapat digulir"]',
      );
      if (chartRegion) {
        const regionRect = chartRegion.getBoundingClientRect();
        const canvas = chartRegion.firstElementChild as HTMLElement | null;
        const labels = [
          ...chartRegion.querySelectorAll<SVGTextElement>(
            ".recharts-label-list text",
          ),
        ];
        const bars = [
          ...chartRegion.querySelectorAll<SVGGraphicsElement>(
            ".recharts-bar-rectangle",
          ),
        ];
        chart = {
          regionHeight: regionRect.height,
          canvasHeight: canvas ? canvas.getBoundingClientRect().height : null,
          svg: chartRegion.querySelector("svg") !== null,
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
            ? Math.max(...bars.map((bar) => bar.getBoundingClientRect().height))
            : 0,
          innerOverflow: chartRegion.scrollWidth - chartRegion.clientWidth,
        };
      }

      const canvas = document.querySelector("[data-map-canvas]");
      const map = canvas ? { height: box(canvas)!.height } : null;

      const donutNode = document.querySelector("[data-theme-donut]");
      const legendNode = document.querySelector(
        '#tema-konten [role="region"][aria-label^="Legenda tema"]',
      );
      const donut = donutNode
        ? {
            width: box(donutNode)!.width,
            height: box(donutNode)!.height,
            legendHeight: legendNode ? box(legendNode)!.height : null,
          }
        : null;

      const tracks = [
        ...document.querySelectorAll<HTMLElement>("[data-ranking-track]"),
      ];
      const trackHeights = tracks.map(
        (track) => track.getBoundingClientRect().height,
      );
      const rankingText = hasCollaboration
        ? [
            document.getElementById("fkrtl"),
            document.getElementById("fktp"),
            document.getElementById("pemda"),
            document.getElementById("stakeholder"),
          ]
            .map((node) => node?.innerText ?? "")
            .join(" ")
        : "";

      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        containerGap: Number.isFinite(rowGap) ? rowGap : null,
        mainPadding: Number.isFinite(mainPadding) ? mainPadding : null,
        header: header ?? null,
        actions: actions ?? null,
        meta: meta ?? null,
        actionHeights,
        actionGap,
        gaps,
        panels: panelBoxes,
        panelPadding: Number.isFinite(panelPadding) ? panelPadding : null,
        cardGapX,
        chart,
        map,
        donut,
        ranking: {
          count: tracks.length,
          trackMin: trackHeights.length ? Math.min(...trackHeights) : null,
          trackMax: trackHeights.length ? Math.max(...trackHeights) : null,
          percents: (rankingText.match(/%/g) ?? []).length,
        },
      };
    },
    {
      chartId: dashboard.chartId,
      hasFilter: dashboard.hasFilter,
      hasCollaboration: dashboard.hasCollaboration,
      panelIds: [...PANEL_IDS],
      gapKeys,
    },
  );
}

function overlaps(left: LayoutBox, right: LayoutBox): boolean {
  return (
    left.left < right.right &&
    right.left < left.right &&
    left.top < right.bottom &&
    right.top < left.bottom
  );
}

async function expectProportionalLayout(
  page: Page,
  dashboard: DashboardConfig,
  mode: "desktop" | "mobile",
): Promise<void> {
  const metrics = await layoutMetrics(page, dashboard);

  expect(
    metrics.overflow,
    "tidak boleh ada overflow horizontal",
  ).toBeLessThanOrEqual(1);

  expect(metrics.containerGap, "ritme gap halaman").not.toBeNull();
  expect(
    metrics.containerGap!,
    "gap antar blok halaman",
  ).toBeGreaterThanOrEqual(20);
  expect(metrics.containerGap!, "gap antar blok halaman").toBeLessThanOrEqual(
    32,
  );

  expect(metrics.mainPadding, "padding main").not.toBeNull();
  expect(metrics.mainPadding!, "padding main minimum").toBeGreaterThanOrEqual(
    16,
  );
  expect(metrics.mainPadding!, "padding main maksimum").toBeLessThanOrEqual(32);

  expect(metrics.header, "header halaman").not.toBeNull();
  expect(metrics.actions, "kolom aksi header").not.toBeNull();
  for (const [index, height] of metrics.actionHeights.entries()) {
    expect(height, `tinggi tombol aksi ${index + 1}`).toBeGreaterThanOrEqual(
      35,
    );
    expect(height, `tinggi tombol aksi ${index + 1}`).toBeLessThanOrEqual(42);
  }

  if (mode === "desktop") {
    expect(
      Math.abs(metrics.actions!.right - metrics.header!.right),
      "aksi header harus rata kanan dengan header",
    ).toBeLessThanOrEqual(2);
    expect(metrics.meta, "meta header").not.toBeNull();
    expect(
      metrics.meta!.top,
      "meta harus berada di bawah aksi",
    ).toBeGreaterThanOrEqual(metrics.actions!.bottom - 1);
    if (metrics.actionGap !== null) {
      expect(
        metrics.actionGap,
        "jarak antar tombol aksi",
      ).toBeGreaterThanOrEqual(6);
      expect(metrics.actionGap, "jarak antar tombol aksi").toBeLessThanOrEqual(
        10,
      );
    }
  } else {
    expect(
      Math.abs(metrics.actions!.left - metrics.header!.left),
      "aksi header rata kiri pada mobile",
    ).toBeLessThanOrEqual(2);
    expect(metrics.meta, "meta header").not.toBeNull();
    expect(
      metrics.meta!.top,
      "meta di bawah aksi pada mobile",
    ).toBeGreaterThanOrEqual(metrics.actions!.bottom - 1);
  }

  for (const { key, value } of metrics.gaps) {
    if (value === null) continue;
    const [min, max] = GAP_BANDS[key]!;
    expect(value, `jarak ${key} minimum ${min}px`).toBeGreaterThanOrEqual(
      min - 0.5,
    );
    expect(value, `jarak ${key} maksimum ${max}px`).toBeLessThanOrEqual(
      max + 0.5,
    );
  }

  expect(metrics.panelPadding, "padding panel").not.toBeNull();
  expect(metrics.panelPadding!, "padding panel minimum").toBeGreaterThanOrEqual(
    16,
  );
  expect(metrics.panelPadding!, "padding panel maksimum").toBeLessThanOrEqual(
    24,
  );

  if (dashboard.hasCollaboration) {
    for (const id of PANEL_IDS) {
      expect(metrics.panels[id], `panel #${id} harus ada`).not.toBeNull();
    }

    if (mode === "desktop") {
      expect(metrics.cardGapX, "jarak antar kartu peringkat").not.toBeNull();
      expect(
        metrics.cardGapX!,
        "jarak antar kartu peringkat minimum",
      ).toBeGreaterThanOrEqual(12);
      expect(
        metrics.cardGapX!,
        "jarak antar kartu peringkat maksimum",
      ).toBeLessThanOrEqual(20);

      const rows: [string, string][] = [
        ["fkrtl", "fktp"],
        ["pemda", "stakeholder"],
      ];
      for (const [leftId, rightId] of rows) {
        const left = metrics.panels[leftId]!;
        const right = metrics.panels[rightId]!;
        expect(
          Math.abs(left.top - right.top),
          `${leftId} dan ${rightId} harus sebaris`,
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(left.width - right.width),
          `${leftId} dan ${rightId} harus selebar`,
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(left.height - right.height),
          `${leftId} dan ${rightId} harus setinggi`,
        ).toBeLessThanOrEqual(2);
        expect(
          overlaps(left, right),
          `${leftId} dan ${rightId} tidak boleh bertumpuk`,
        ).toBe(false);
      }
    } else {
      const leftEdge = metrics.panels.fkrtl!.left;
      for (const id of PANEL_IDS) {
        expect(
          Math.abs(metrics.panels[id]!.left - leftEdge),
          `panel #${id} harus rata kiri pada mobile`,
        ).toBeLessThanOrEqual(1);
      }
    }

    expect(metrics.ranking.count, "bar peringkat harus tampil").toBeGreaterThan(
      0,
    );
    expect(
      metrics.ranking.trackMin!,
      "track peringkat minimum 6px",
    ).toBeGreaterThanOrEqual(5.5);
    expect(
      metrics.ranking.trackMax!,
      "track peringkat maksimum 8px",
    ).toBeLessThanOrEqual(8.5);
    expect(metrics.ranking.percents, "ranking tanpa persentase").toBe(0);
  }

  if (dashboard.chartId) {
    const empty = await page
      .locator(`#${dashboard.chartId}`)
      .getByText(/Belum ada (cabang|institusi|konten tervalidasi)/)
      .count();
    if (empty === 0) {
      expect(metrics.chart, "grafik harus dirender").not.toBeNull();
      expect(metrics.chart!.svg, "grafik harus merender SVG").toBe(true);
      expect(
        metrics.chart!.regionHeight,
        "tinggi area grafik minimum",
      ).toBeGreaterThanOrEqual(158);
      expect(
        metrics.chart!.regionHeight,
        "tinggi area grafik maksimum",
      ).toBeLessThanOrEqual(362);
      if (metrics.chart!.canvasHeight !== null) {
        expect(
          metrics.chart!.canvasHeight,
          "tinggi kanvas grafik minimum",
        ).toBeGreaterThanOrEqual(159);
        expect(
          metrics.chart!.canvasHeight,
          "tinggi kanvas grafik maksimum",
        ).toBeLessThanOrEqual(380);
      }
      expect(metrics.chart!.labels, "label nilai di ujung bar").toBeGreaterThan(
        0,
      );
      expect(
        metrics.chart!.labelOverflow,
        "label nilai tidak boleh terpotong",
      ).toBeLessThanOrEqual(1.5);
      expect(
        metrics.chart!.innerOverflow,
        "grafik tidak boleh overflow horizontal",
      ).toBeLessThanOrEqual(1);
      if (metrics.chart!.barThickness > 0) {
        expect(
          metrics.chart!.barThickness,
          "tebal bar minimum",
        ).toBeGreaterThanOrEqual(10);
        expect(
          metrics.chart!.barThickness,
          "tebal bar maksimum",
        ).toBeLessThanOrEqual(16);
      }
    }
  }

  if (dashboard.hasCollaboration) {
    if (metrics.map) {
      expect(metrics.map.height, "tinggi peta minimum").toBeGreaterThanOrEqual(
        258,
      );
      expect(metrics.map.height, "tinggi peta maksimum").toBeLessThanOrEqual(
        342,
      );
    } else {
      await expect(page.locator("#peta")).toContainText(
        "Belum ada konten tervalidasi dengan lokasi",
      );
    }
  }

  if (metrics.donut) {
    expect(metrics.donut.width, "lebar donut").toBeGreaterThanOrEqual(210);
    expect(metrics.donut.height, "tinggi donut minimum").toBeGreaterThanOrEqual(
      210,
    );
    expect(metrics.donut.height, "tinggi donut maksimum").toBeLessThanOrEqual(
      240,
    );
    if (metrics.donut.legendHeight !== null) {
      expect(
        metrics.donut.legendHeight,
        "legenda tema tidak boleh lebih tinggi dari donut",
      ).toBeLessThanOrEqual(metrics.donut.height + 1);
    }
  } else {
    await expect(
      page.getByText(/Belum ada konten Non-EDUFAST pada /),
    ).toBeVisible();
  }
}

for (const dashboard of DASHBOARDS) {
  test.describe(`Dashboard ${dashboard.name} (${dashboard.variant})`, () => {
    test.use({ storageState: dashboard.state });

    test("komposisi section mengikuti varian peran", async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await waitForDashboard(page, dashboard);

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: dashboard.heading,
        }),
      ).toBeVisible();

      for (const label of dashboard.kpis) {
        await expect(
          page.locator("#ringkasan").getByText(label, { exact: true }),
        ).toBeVisible();
      }

      if (dashboard.chartId === "konten-per-cabang") {
        await expect(
          page.getByRole("heading", { name: "Konten per Cabang" }),
        ).toBeVisible();
      } else if (dashboard.chartId === "konten-per-institusi") {
        await expect(
          page.getByRole("heading", { name: "Konten per Institusi" }),
        ).toBeVisible();
      } else {
        await expect(page.locator("#konten-per-cabang")).toHaveCount(0);
        await expect(page.locator("#konten-per-institusi")).toHaveCount(0);
      }

      if (dashboard.hasCollaboration) {
        await expect(
          page.getByRole("heading", { name: "Kolaborasi", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Sebaran Konten" }),
        ).toBeVisible();
        for (const section of CATEGORY_SECTIONS) {
          await expect(
            page.getByRole("heading", {
              name: `Konten ${section.label}`,
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", {
              name: `10 ${section.label} Teratas`,
              exact: true,
            }),
          ).toBeVisible();
        }
      } else {
        await expect(page.locator("#kolaborasi")).toHaveCount(0);
        await expect(page.locator("#peta")).toHaveCount(0);
        await expect(page.locator("#fkrtl")).toHaveCount(0);
      }

      if (dashboard.hasFilter) {
        await expect(page.locator("#pilih-cabang")).toBeVisible();
      } else {
        await expect(page.locator("#pilih-cabang")).toHaveCount(0);
      }

      await expect(
        page.getByRole("heading", { name: "Tema Konten", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Tema Non-EDUFAST" }),
      ).toBeVisible();

      for (const legacy of [
        "#tren-bulanan",
        "#tren-tema",
        "#tabel",
        "#peringkat",
      ]) {
        await expect(page.locator(legacy)).toHaveCount(0);
      }
      await expect(
        page.getByRole("region", { name: "Filter dasbor" }),
      ).toHaveCount(0);

      expect(
        await sectionDomOrder(page, SECTION_ORDER[dashboard.variant]!),
      ).toEqual(SECTION_ORDER[dashboard.variant]!);

      expect(pageErrors).toEqual([]);
    });

    test("aksi kanan header dan copy tombol", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await waitForDashboard(page, dashboard);
      await page.evaluate(() => document.fonts.ready);

      const metrics = await layoutMetrics(page, dashboard);
      expect(metrics.header).not.toBeNull();
      expect(metrics.actions).not.toBeNull();
      expect(metrics.meta).not.toBeNull();

      expect(
        Math.abs(metrics.actions!.right - metrics.header!.right),
        "aksi harus menempel di sisi kanan header",
      ).toBeLessThanOrEqual(2);
      expect(
        metrics.meta!.top,
        "meta tampil di bawah aksi",
      ).toBeGreaterThanOrEqual(metrics.actions!.bottom - 1);

      const trigger = page.locator("[data-dashboard-export-trigger]");
      await expect(trigger).toBeVisible();
      await expect(trigger).toContainText("Unduh laporan");
      await expect(trigger).toHaveAttribute(
        "aria-label",
        "Unduh laporan dashboard",
      );

      await expect(
        page
          .locator("[data-page-header-actions]")
          .getByRole("link", { name: dashboard.secondaryAction, exact: true }),
      ).toBeVisible();
    });

    test("filter dan cakupan data sesuai peran", async ({ page }) => {
      await waitForDashboard(page, dashboard);

      const totalBefore = await scoreAt(page, "#ringkasan p.tabular");

      if (dashboard.hasFilter) {
        const branchesBefore = await page
          .locator("#ringkasan p.tabular")
          .nth(1)
          .innerText();
        const chartBefore = await scoreAt(
          page,
          `#${dashboard.chartId} p .tabular`,
        );

        await waitForDashboard(
          page,
          dashboard,
          `${dashboard.path}?cabang=none`,
        );
        await expect(page.getByText(/Tidak ada cabang dipilih/)).toBeVisible();
        for (const section of CATEGORY_SECTIONS) {
          expect(
            await scoreAt(page, `#${section.anchor} > p.tabular`),
            `${section.label} harus nol saat tidak ada cabang dipilih`,
          ).toBe(0);
        }
        expect(await scoreAt(page, "#edufast p.tabular")).toBe(0);
        expect(await scoreAt(page, "#non-edufast p.tabular")).toBe(0);
        expect(await scoreAt(page, "#ringkasan p.tabular")).toBe(totalBefore);
        expect(
          await page.locator("#ringkasan p.tabular").nth(1).innerText(),
        ).toBe(branchesBefore);
        // The overview chart belongs to the unfiltered summary group, like the
        // KPI above it; only collaboration and theme narrow with the filter.
        expect(await scoreAt(page, `#${dashboard.chartId} p .tabular`)).toBe(
          chartBefore,
        );

        await waitForDashboard(
          page,
          dashboard,
          `${dashboard.path}?cabang=${OUT_OF_SCOPE_BRANCH}`,
        );
        for (const section of CATEGORY_SECTIONS) {
          expect(
            await scoreAt(page, `#${section.anchor} > p.tabular`),
            `${section.label} harus nol untuk cabang di luar cakupan`,
          ).toBe(0);
        }
        expect(await scoreAt(page, "#edufast p.tabular")).toBe(0);
        expect(await scoreAt(page, "#non-edufast p.tabular")).toBe(0);
        expect(await scoreAt(page, "#ringkasan p.tabular")).toBe(totalBefore);
      } else {
        // Branch and stakeholder scopes are fixed: a stale `?cabang=none`
        // link must never empty their own data.
        const rankingBefore = dashboard.hasCollaboration
          ? await scoreAt(page, "#fkrtl > p.tabular")
          : null;
        const eduBefore = await scoreAt(page, "#edufast p.tabular");

        await waitForDashboard(
          page,
          dashboard,
          `${dashboard.path}?cabang=none`,
        );

        await expect(page.getByText(/Tidak ada cabang dipilih/)).toHaveCount(0);
        expect(await scoreAt(page, "#ringkasan p.tabular")).toBe(totalBefore);
        expect(await scoreAt(page, "#edufast p.tabular")).toBe(eduBefore);
        if (dashboard.hasCollaboration) {
          expect(await scoreAt(page, "#fkrtl > p.tabular")).toBe(rankingBefore);
        }
        if (dashboard.chartId) {
          const empty = await page
            .locator(`#${dashboard.chartId}`)
            .getByText(/Belum ada (cabang|institusi|konten tervalidasi)/)
            .count();
          if (empty === 0) {
            await expect(
              page
                .locator(`#${dashboard.chartId} .recharts-bar-rectangle`)
                .first(),
            ).toBeVisible();
          }
        }
      }
    });

    test("layout proporsional dan header pada 1440x900", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await waitForDashboard(page, dashboard);
      await page.evaluate(() => document.fonts.ready);
      await expectProportionalLayout(page, dashboard, "desktop");
    });

    test("layout proporsional dan header pada 375x812", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await waitForDashboard(page, dashboard);
      await page.evaluate(() => document.fonts.ready);
      await expectProportionalLayout(page, dashboard, "mobile");
    });
  });
}

test.describe("Dashboard master interaksi", () => {
  test.use({ storageState: ADMIN_STATE });

  const master = DASHBOARDS[0];

  test("Pilih Semua tri-state dan URL cabang aman", async ({ page }) => {
    await waitForDashboard(page, master);
    const totalBefore = await scoreAt(page, "#ringkasan p.tabular");
    const selectAll = page.locator("#pilih-semua-cabang");

    await expect(selectAll).toBeChecked();
    await selectAll.click();
    await page.waitForURL(/cabang=none/);
    await expect(selectAll).not.toBeChecked();
    await expect(page.getByText(/Tidak ada cabang dipilih/)).toBeVisible();
    expect(await scoreAt(page, "#fkrtl > p.tabular")).toBe(0);

    await selectAll.click();
    await page.waitForURL((url) => !url.searchParams.has("cabang"));
    await expect(selectAll).toBeChecked();
    expect(await scoreAt(page, "#ringkasan p.tabular")).toBe(totalBefore);

    const branches = page.locator(
      '#pilih-cabang input[type="checkbox"][id^="cabang-"]',
    );
    await openBranchList(page);
    const branchCount = await branches.count();
    expect(branchCount).toBeGreaterThan(0);
    await branches.first().click();
    await page.waitForURL(/cabang=/);
    await expect
      .poll(() =>
        selectAll.evaluate((node) => (node as HTMLInputElement).indeterminate),
      )
      .toBe(true);
    await expect(
      page.locator("#pilih-cabang").getByText(/dari \d+.*cabang dipilih/),
    ).toBeVisible();
  });

  test("peringkat menurun tanpa persentase dan bar proporsional", async ({
    page,
  }) => {
    await waitForDashboard(page, master);
    await expect(page.locator("[data-ranking-share]")).toHaveCount(0);

    for (const section of CATEGORY_SECTIONS) {
      const panel = page.locator(`#${section.anchor}`);
      const score = await scoreAt(page, `#${section.anchor} > p.tabular`);
      const rows = panel.locator("ol > li");
      const count = await rows.count();
      expect(count).toBeLessThanOrEqual(10);
      if (count === 0) continue;
      expect(score).toBeGreaterThan(0);
      await expect(panel).not.toContainText("%");

      const measured: { total: number; width: number }[] = [];
      for (let index = 0; index < count; index += 1) {
        const row = rows.nth(index);
        await expect(row.locator("p").first()).not.toBeEmpty();
        await expect(row.locator("p").nth(1)).not.toBeEmpty();
        const total = parseNumber(
          await row.locator("span.shrink-0").last().innerText(),
        );

        const track = await row.locator("[data-ranking-track]").boundingBox();
        const fill = await row.locator("[data-ranking-fill]").boundingBox();
        expect(
          track,
          `${section.label} baris ${index + 1}: track`,
        ).not.toBeNull();
        expect(
          fill,
          `${section.label} baris ${index + 1}: fill`,
        ).not.toBeNull();
        expect(track!.height, "tebal track 6px").toBeGreaterThanOrEqual(5.5);
        expect(track!.height, "tebal track 6px").toBeLessThanOrEqual(8.5);

        const ratio = fill!.width / track!.width;
        expect(
          Math.abs(ratio - total / score),
          `${section.label} baris ${index + 1}: panjang bar`,
        ).toBeLessThanOrEqual(0.04);
        if (total < score) {
          expect(
            ratio,
            `${section.label} baris ${index + 1}: bukan bar penuh`,
          ).toBeLessThan(0.995);
        }
        measured.push({ total, width: fill!.width });
      }

      for (let index = 1; index < measured.length; index += 1) {
        expect(
          measured[index - 1]!.total,
          `${section.label} harus menurun`,
        ).toBeGreaterThanOrEqual(measured[index]!.total);
      }
      if (measured.length > 0) {
        expect(score).toBeGreaterThanOrEqual(measured[0]!.total);
      }
      for (let left = 0; left < measured.length; left += 1) {
        for (let right = left + 1; right < measured.length; right += 1) {
          if (measured[left]!.total === measured[right]!.total) {
            expect(
              Math.abs(measured[left]!.width - measured[right]!.width),
              `${section.label}: nilai seri harus sama panjang`,
            ).toBeLessThanOrEqual(0.5);
          }
        }
      }
    }
  });

  test("bar chart per cabang menurun dan label nilai lengkap", async ({
    page,
  }) => {
    await waitForDashboard(page, master);

    const rows = page.locator("#konten-per-cabang table tbody tr");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    const totals: number[] = [];
    for (let index = 0; index < rowCount; index += 1) {
      totals.push(
        parseNumber(await rows.nth(index).locator("td").last().innerText()),
      );
    }
    const aggregateRows = totals.filter((_, index) => index < rowCount);
    for (let index = 1; index < aggregateRows.length - 1; index += 1) {
      expect(
        aggregateRows[index - 1]!,
        "bar chart harus menurun sebelum bar agregat",
      ).toBeGreaterThanOrEqual(aggregateRows[index]!);
    }

    const labels = await page
      .locator("#konten-per-cabang .recharts-label-list text")
      .allTextContents();
    const rendered = new Set(
      labels.map((label) => parseNumber(label)).filter((value) => value > 0),
    );
    for (const total of totals) {
      expect(
        rendered.has(total),
        `label nilai ${total} harus tampil di ujung bar`,
      ).toBe(true);
    }
  });

  test("tema Non-EDUFAST memakai total dan persentase yang konsisten", async ({
    page,
  }) => {
    await waitForDashboard(page, master);

    const edu = await scoreAt(page, "#edufast p.tabular");
    const nonEdu = await scoreAt(page, "#non-edufast p.tabular");
    const categoryTotal = (
      await Promise.all(
        CATEGORY_SECTIONS.map((section) =>
          scoreAt(page, `#${section.anchor} > p.tabular`),
        ),
      )
    ).reduce((sum, value) => sum + value, 0);
    expect(edu + nonEdu).toBe(categoryTotal);

    const legend = page.locator("#tema-konten ul li");
    const emptyTheme = page.getByText(/Belum ada konten Non-EDUFAST pada /);
    await expect(async () => {
      const rendered = (await legend.count()) + (await emptyTheme.count());
      expect(
        rendered,
        "legenda atau empty state tema harus tampil",
      ).toBeGreaterThan(0);
    }).toPass({ timeout: 15_000 });
    const legendCount = await legend.count();
    if (legendCount === 0) {
      await expect(emptyTheme).toBeVisible();
      return;
    }

    const percentages: number[] = [];
    for (let index = 0; index < legendCount; index += 1) {
      const text = await legend.nth(index).innerText();
      percentages.push(parsePercent(text));
    }
    const sum = percentages.reduce((value, item) => value + item, 0);
    expect(Math.round(sum * 10)).toBe(1000);
  });

  test("peta melaporkan total berlokasi dan legenda kategori", async ({
    page,
  }) => {
    await waitForDashboard(page, master);
    const map = page.locator("#peta");
    await expect(map.getByText(/konten berlokasi/)).toBeVisible();
    await expect(map.getByText(/institusi ditampilkan/)).toBeVisible();
    for (const section of CATEGORY_SECTIONS) {
      await expect(
        map.getByText(section.label, { exact: true }).first(),
      ).toBeVisible();
    }
  });
});
