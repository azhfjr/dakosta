import { expect, test } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

test.describe("Filter detail konten admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test("status, organisasi, tema, dan sub-tema mengubah URL serta tabel", async ({
    page,
  }) => {
    await page.goto("/admin/konten");
    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await expect(filter).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Detail Konten", level: 1 }),
    ).toBeVisible();

    for (const name of [
      "q",
      "status",
      "orgType",
      "mainTheme",
      "subTheme",
      "stakeholderId",
    ]) {
      await expect(filter.locator(`[name="${name}"]`)).toBeVisible();
    }

    await filter.locator('select[name="status"]').selectOption("APPROVED");
    await page.waitForURL(/status=APPROVED/);
    await expect(filter.locator('select[name="status"]')).toHaveValue(
      "APPROVED",
    );

    await filter.locator('select[name="subTheme"]').selectOption({ index: 1 });
    await page.waitForURL(/subTheme=/);
    await expect(filter.locator('select[name="subTheme"]')).not.toHaveValue("");
    await expect(filter.locator('select[name="status"]')).toHaveValue(
      "APPROVED",
    );
  });

  test("atur ulang mengembalikan seluruh filter", async ({ page }) => {
    await page.goto("/admin/konten?status=SUBMITTED");
    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await expect(filter.locator('select[name="status"]')).toHaveValue(
      "SUBMITTED",
    );

    await filter.getByRole("link", { name: "Atur ulang" }).click();
    await page.waitForURL(/\/admin\/konten$/);
    await expect(filter.locator('select[name="status"]')).toHaveValue("");
  });

  test("filter lanjutan memuat jenis konten, platform, periode, dan sortir", async ({
    page,
  }) => {
    await page.goto("/admin/konten");
    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await filter.locator("summary", { hasText: "Filter lanjutan" }).click();

    for (const name of ["type", "platform", "period", "sort", "from", "to"]) {
      await expect(filter.locator(`[name="${name}"]`)).toBeVisible();
    }

    await filter.locator('select[name="type"]').selectOption({ index: 1 });
    await page.waitForURL(/type=/);
    await expect(filter.locator('select[name="type"]')).not.toHaveValue("");
  });

  test("filter antrean SLA memakai dropdown status", async ({ page }) => {
    await page.goto("/admin/validasi");
    const filter = page.getByRole("region", { name: "Filter antrean" });
    await expect(filter.locator('select[name="status"]')).toBeVisible();
    await expect(filter.locator('input[name="q"]')).toBeVisible();
    await expect(filter.locator('select[name="orgType"]')).toBeVisible();
    await expect(filter.locator('select[name="mainTheme"]')).toBeVisible();
    await expect(filter.locator('select[name="subTheme"]')).toBeVisible();
    await expect(filter.locator('select[name="stakeholderId"]')).toHaveCount(0);

    await filter.locator('select[name="status"]').selectOption("SUBMITTED");
    await page.waitForURL(/status=SUBMITTED/);
    await expect(filter.locator('select[name="status"]')).toHaveValue(
      "SUBMITTED",
    );
  });
});

test.describe("Filter detail konten wilayah", () => {
  test.use({ storageState: REGIONAL_STATE });

  test("menampilkan status, organisasi, tema, dan filter lanjutan", async ({
    page,
  }) => {
    await page.goto("/wilayah/konten");
    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await expect(filter.locator('select[name="status"]')).toBeVisible();
    await expect(filter.locator('select[name="orgType"]')).toBeVisible();
    await expect(filter.locator('select[name="subTheme"]')).toBeVisible();

    await filter.locator("summary", { hasText: "Filter lanjutan" }).click();
    await expect(filter.locator('select[name="period"]')).toBeVisible();
    await expect(filter.locator('select[name="type"]')).toBeVisible();
    await expect(filter.locator('select[name="sort"]')).toBeVisible();

    await filter.locator('select[name="sort"]').selectOption("title");
    await page.waitForURL(/sort=title/);
    await expect(filter.locator('select[name="sort"]')).toHaveValue("title");
  });
});

test.describe("Filter detail konten cabang", () => {
  test.use({ storageState: BRANCH_STATE });

  test("menampilkan filter status dan jenis konten", async ({ page }) => {
    await page.goto("/cabang/konten");
    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await expect(filter.locator('select[name="status"]')).toBeVisible();
    await filter.locator("summary", { hasText: "Filter lanjutan" }).click();
    await expect(filter.locator('select[name="type"]')).toBeVisible();

    await filter.locator('select[name="type"]').selectOption({ index: 1 });
    await page.waitForURL(/type=/);
    await expect(filter.locator('select[name="type"]')).not.toHaveValue("");
  });
});

test.describe("Filter detail konten stakeholder", () => {
  test.use({ storageState: CLIENT_STATE });

  test("status, sub-tema, dan sortir memakai dropdown", async ({ page }) => {
    await page.goto("/client/konten");
    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await expect(filter.locator('select[name="status"]')).toBeVisible();
    await expect(filter.locator('select[name="subTheme"]')).toBeVisible();

    await filter.locator("summary", { hasText: "Filter lanjutan" }).click();
    await filter.locator('select[name="sort"]').selectOption("title");
    await page.waitForURL(/sort=title/);
    await expect(filter.locator('select[name="sort"]')).toHaveValue("title");
  });
});

test.describe("Filter cabang dashboard", () => {
  test.use({ storageState: ADMIN_STATE });

  test("checklist cabang memakai parameter berulang dan menyimpan filter lain", async ({
    page,
  }) => {
    await page.goto("/admin?view=tema-konten");
    const checklist = page.locator("#pilih-cabang");
    await expect(
      checklist.getByRole("heading", { name: "Cabang", exact: true }),
    ).toBeVisible();

    await checklist.locator("summary").click();
    const branch = checklist.locator('input[id^="cabang-"]').first();
    await expect(branch).toBeVisible();
    await branch.click();
    await page.waitForURL(/cabang=/);

    const url = new URL(page.url());
    expect(url.hash).toBe("#tema-konten");
    expect(url.searchParams.getAll("cabang").length).toBeGreaterThan(0);
    await expect(page.locator("#tema-konten")).toBeVisible();
  });

  test("dropdown wilayah memilih seluruh cabang wilayah dan dapat direset", async ({
    page,
  }) => {
    await page.goto("/admin#tema-konten");
    const checklist = page.locator("#pilih-cabang");
    const regionSelect = checklist.getByLabel("Wilayah");
    await expect(regionSelect).toBeVisible();
    await expect(regionSelect).toHaveValue("all");
    // The branch popover only renders its list while open, so open it before
    // counting the branches grouped by region.
    await checklist.locator("summary").click();

    const regionOption = regionSelect.locator("option").nth(1);
    const regionValue = await regionOption.getAttribute("value");
    expect(regionValue).toMatch(/^region:/);
    const region = regionValue!.slice("region:".length);

    const expected = await checklist.evaluate((root, regionName) => {
      const groups = Array.from(
        root.querySelectorAll("[data-region]"),
      ) as HTMLElement[];
      const group = groups.find((item) => item.dataset.region === regionName);
      return group ? group.querySelectorAll('input[id^="cabang-"]').length : 0;
    }, region);
    expect(expected).toBeGreaterThan(0);

    await regionSelect.selectOption(regionValue!);
    await page.waitForURL(
      (url) => url.searchParams.getAll("cabang").length === expected,
    );
    const url = new URL(page.url());
    expect(url.hash).toBe("#tema-konten");
    expect(url.searchParams.getAll("cabang")).toHaveLength(expected);
    await expect(regionSelect).toHaveValue(regionValue!);
    await expect(page.locator("#tema-konten")).toBeVisible();

    await regionSelect.selectOption("all");
    await page.waitForURL((target) => !target.searchParams.has("cabang"));
    expect(new URL(page.url()).hash).toBe("#tema-konten");
    await expect(checklist.locator("#pilih-semua-cabang")).toBeChecked();
  });
});
