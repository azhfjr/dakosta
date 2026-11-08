import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

const DASHBOARDS = [
  { name: "admin", path: "/admin", state: ADMIN_STATE },
  { name: "wilayah", path: "/wilayah/dashboard", state: REGIONAL_STATE },
  { name: "cabang", path: "/cabang/dashboard", state: BRANCH_STATE },
  { name: "stakeholder", path: "/client", state: CLIENT_STATE },
];

const SECTION_ORDER = [
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

const CATEGORY_SECTIONS = [
  { anchor: "fkrtl", label: "FKRTL" },
  { anchor: "fktp", label: "FKTP" },
  { anchor: "pemda", label: "Pemda" },
  { anchor: "stakeholder", label: "Stakeholder" },
];

const OUT_OF_SCOPE_BRANCH = "00000000-0000-4000-8000-000000000000";

const PAGE_HEADING: Record<string, RegExp> = {
  admin: /^Dashboard$/,
  wilayah: /^Dashboard wilayah$/,
  cabang: /^Dashboard cabang$/,
  stakeholder: /^Beranda /,
};

function parseNumber(text: string): number {
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

async function waitForDashboard(page: Page, path: string): Promise<void> {
  await page.goto(path);
  // The three dashboard groups stream independently; wait for one anchor of
  // each group before reading numbers or interacting with the checklist.
  await expect(page.locator("#ringkasan")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#konten-per-cabang")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("#pilih-cabang")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#peta")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#tema-konten")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#non-edufast")).toBeVisible({ timeout: 30_000 });
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

function parsePercent(text: string): number {
  const match = text.match(/([\d.,]+)%/);
  if (!match) throw new Error(`Persentase tidak ditemukan: ${text}`);
  return Number(match[1]!.replace(/\./g, "").replace(",", "."));
}

async function sectionDomOrder(page: Page): Promise<string[]> {
  return page.evaluate((ids) => {
    const nodes = ids.map((id) => {
      const node = document.getElementById(id);
      if (!node) throw new Error(`Section #${id} tidak ditemukan`);
      return node;
    });
    return [...nodes]
      .sort((left, right) => (left.compareDocumentPosition(right) & 4 ? -1 : 1))
      .map((node) => node.id);
  }, SECTION_ORDER);
}

async function orderOffsets(page: Page): Promise<number[]> {
  return page.evaluate(
    (ids) =>
      ids.map((id) => {
        const node = document.getElementById(id);
        if (!node) throw new Error(`Section #${id} tidak ditemukan`);
        return node.getBoundingClientRect().top + window.scrollY;
      }),
    SECTION_ORDER,
  );
}

for (const dashboard of DASHBOARDS) {
  test.describe(`Dashboard ${dashboard.name}`, () => {
    test.use({ storageState: dashboard.state });

    test("urutan section wajib dan tanpa tren atau tabel lama", async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await waitForDashboard(page, dashboard.path);

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: PAGE_HEADING[dashboard.name]!,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Konten per Cabang" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Kolaborasi", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Tema Konten", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator("#ringkasan").getByText("Total Konten Tervalidasi", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.locator("#ringkasan").getByText("Cabang dengan Konten", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page
          .locator("#ringkasan")
          .getByText(/^\d+ dari \d+ cabang$/, { exact: false })
          .first(),
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

      await expect(
        page.getByRole("heading", { name: "Sebaran Konten" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Tema Non-EDUFAST" }),
      ).toBeVisible();

      await expect(page.locator("#tren-bulanan")).toHaveCount(0);
      await expect(page.locator("#tren-tema")).toHaveCount(0);
      await expect(page.locator("#tabel")).toHaveCount(0);
      await expect(page.locator("#peringkat")).toHaveCount(0);
      await expect(page.locator("#semua-konten")).toHaveCount(0);
      await expect(
        page.getByRole("region", { name: "Filter dasbor" }),
      ).toHaveCount(0);
      await expect(page.getByText(/\bBlok \d/)).toHaveCount(0);

      expect(await sectionDomOrder(page)).toEqual(SECTION_ORDER);
      const offsets = await orderOffsets(page);
      for (let index = 1; index < offsets.length; index += 1) {
        expect(
          offsets[index]!,
          `${SECTION_ORDER[index]} tidak boleh tampil di atas ${SECTION_ORDER[index - 1]}`,
        ).toBeGreaterThanOrEqual(offsets[index - 1]!);
      }

      expect(pageErrors).toEqual([]);
    });

    test("filter cabang kosong mengubah kolaborasi dan tema tanpa mengubah ringkasan", async ({
      page,
    }) => {
      await waitForDashboard(page, dashboard.path);

      const totalBefore = await scoreAt(page, "#ringkasan p.tabular");
      const branchesBefore = await page
        .locator("#ringkasan p.tabular")
        .nth(1)
        .innerText();

      await waitForDashboard(page, `${dashboard.path}?cabang=none`);

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
    });

    test("cabang di luar cakupan tidak membuka data", async ({ page }) => {
      await waitForDashboard(page, dashboard.path);
      const totalBefore = await scoreAt(page, "#ringkasan p.tabular");

      await waitForDashboard(
        page,
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
    });
  });
}

test.describe("Dashboard admin interaksi", () => {
  test.use({ storageState: ADMIN_STATE });

  test("Pilih Semua tri-state dan URL cabang aman", async ({ page }) => {
    await waitForDashboard(page, "/admin");
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
    const branchCount = await branches.count();
    expect(branchCount).toBeGreaterThan(0);
    await openBranchList(page);
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

  test("sepuluh peringkat teratas menurun dan tidak melebihi skor", async ({
    page,
  }) => {
    await waitForDashboard(page, "/admin");

    for (const section of CATEGORY_SECTIONS) {
      const score = await scoreAt(page, `#${section.anchor} > p.tabular`);
      const rows = page.locator(`#${section.anchor} ol > li`);
      const count = await rows.count();
      expect(count).toBeLessThanOrEqual(10);

      const totals: number[] = [];
      for (let index = 0; index < count; index += 1) {
        const row = rows.nth(index);
        await expect(row.locator("p").first()).not.toBeEmpty();
        await expect(row.locator("p").nth(1)).not.toBeEmpty();
        totals.push(
          parseNumber(await row.locator("span.shrink-0").last().innerText()),
        );
      }
      for (let index = 1; index < totals.length; index += 1) {
        expect(
          totals[index - 1]!,
          `${section.label} harus menurun`,
        ).toBeGreaterThanOrEqual(totals[index]!);
      }
      if (totals.length > 0) {
        expect(score).toBeGreaterThanOrEqual(totals[0]!);
      }
    }
  });

  test("bar peringkat proporsional terhadap skor kategori", async ({
    page,
  }) => {
    await waitForDashboard(page, "/admin");

    for (const section of CATEGORY_SECTIONS) {
      const panel = page.locator(`#${section.anchor}`);
      const score = await scoreAt(page, `#${section.anchor} > p.tabular`);
      const rows = panel.locator("ol > li");
      const count = await rows.count();
      expect(count).toBeLessThanOrEqual(10);
      if (count === 0) continue;
      expect(score).toBeGreaterThan(0);

      const measured: { total: number; width: number }[] = [];
      for (let index = 0; index < count; index += 1) {
        const row = rows.nth(index);
        const total = parseNumber(
          await row.locator("span.shrink-0").last().innerText(),
        );
        const share = parsePercent(
          await row.locator("[data-ranking-share]").innerText(),
        );
        expect(
          Math.abs(share - (total / score) * 100),
          `${section.label} baris ${index + 1}: label persen`,
        ).toBeLessThanOrEqual(1);

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

  test("dashboard muat dalam satu layar 1440x900 tanpa gulir vertikal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForDashboard(page, "/admin");
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollHeight - window.innerHeight,
          ),
        { timeout: 15_000 },
      )
      .toBeLessThanOrEqual(2);

    const anchors = await page.evaluate((ids) => {
      return ids.map((id) => {
        const node = document.getElementById(id);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { id, top: rect.top, bottom: rect.bottom };
      });
    }, SECTION_ORDER);
    for (const anchor of anchors) {
      expect(anchor, "seluruh anchor harus ada").not.toBeNull();
      expect(
        anchor!.top,
        `${anchor!.id} harus di dalam layar`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        anchor!.bottom,
        `${anchor!.id} harus di dalam layar`,
      ).toBeLessThanOrEqual(902);
    }
  });

  test("tema Non-EDUFAST memakai total dan persentase yang konsisten", async ({
    page,
  }) => {
    await waitForDashboard(page, "/admin");

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
    const emptyTheme = page.getByText(
      "Belum ada konten Non-EDUFAST pada cabang terpilih.",
      { exact: true },
    );
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
      const match = text.match(/([\d.,]+)%/);
      expect(match, `persentase pada baris legenda ${index}`).not.toBeNull();
      percentages.push(Number(match![1]!.replace(/\./g, "").replace(",", ".")));
    }
    const sum = percentages.reduce((value, item) => value + item, 0);
    expect(Math.round(sum * 10)).toBe(1000);
  });

  test("peta melaporkan total berlokasi dan legenda kategori", async ({
    page,
  }) => {
    await waitForDashboard(page, "/admin");
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
