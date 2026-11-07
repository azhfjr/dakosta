import { expect, test } from "@playwright/test";

import { BRANCH_STATE, CLIENT_STATE, REGIONAL_STATE } from "./support";

test.describe("Detail konten wilayah", () => {
  test.use({ storageState: REGIONAL_STATE });

  test("menampilkan seluruh status dengan filter dropdown, sortir, dan ekspor", async ({
    page,
  }) => {
    await page.goto("/wilayah/konten");
    await expect(
      page.getByRole("heading", { name: "Detail Konten", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Detail konten", level: 2 }),
    ).toBeVisible();

    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await expect(filter.locator('select[name="status"]')).toBeVisible();
    await expect(filter.locator('option[value="APPROVED"]')).toHaveText(
      "Hanya disetujui",
    );

    await filter.locator("summary", { hasText: "Filter lanjutan" }).click();
    await filter.locator('select[name="sort"]').selectOption("title");
    await page.waitForURL(/sort=title/);
    await expect(filter.locator('select[name="sort"]')).toHaveValue("title");

    await expect(
      page.getByRole("link", { name: "Ekspor CSV" }),
    ).toHaveAttribute("href", /^\/api\/v1\/exports\/submissions\?mode=all/);
    await expect(page.getByRole("link", { name: "Unduh PDF" })).toHaveAttribute(
      "href",
      /^\/api\/v1\/reports\/contents\?mode=all/,
    );
  });

  test("status pada URL menyaring tabel tanpa membuang status lain", async ({
    page,
  }) => {
    await page.goto("/wilayah/konten?status=SUBMITTED");
    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await expect(filter.locator('select[name="status"]')).toHaveValue(
      "SUBMITTED",
    );
    await expect(page.getByText(/konten sesuai filter/i).first()).toBeVisible();
  });
});

test.describe("Detail konten cabang", () => {
  test.use({ storageState: BRANCH_STATE });

  test("menampilkan status dan filter jenis konten", async ({ page }) => {
    await page.goto("/cabang/konten");
    await expect(
      page.getByRole("heading", { name: "Detail Konten", level: 1 }),
    ).toBeVisible();
    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await expect(filter.locator('select[name="status"]')).toBeVisible();
    await filter.locator("summary", { hasText: "Filter lanjutan" }).click();
    await expect(filter.locator('select[name="type"]')).toBeVisible();
    await expect(filter.locator('select[name="platform"]')).toBeVisible();
  });
});

test.describe("Batas peran halaman Konten", () => {
  test.use({ storageState: CLIENT_STATE });

  test("stakeholder tidak dapat membuka Konten wilayah", async ({ page }) => {
    await page.goto("/wilayah/konten");
    await page.waitForURL(/akses-ditolak/);
  });
});
