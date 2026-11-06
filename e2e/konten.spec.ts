import { expect, test } from "@playwright/test";

import { BRANCH_STATE, CLIENT_STATE, REGIONAL_STATE } from "./support";

test.describe("Konten disetujui wilayah", () => {
  test.use({ storageState: REGIONAL_STATE });

  test("menampilkan tabel approved dengan filter dropdown dan sortir", async ({
    page,
  }) => {
    await page.goto("/wilayah/konten");
    await expect(
      page.getByRole("heading", { name: "Konten disetujui", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Tervalidasi").first()).toBeVisible();
    await expect(
      page.getByText(/hanya status Disetujui yang ditampilkan/i),
    ).toBeVisible();
    await expect(page.locator('select[name="status"]')).toHaveCount(0);

    await page.locator('select[name="sort"]').selectOption("title");
    await page.waitForURL(/sort=title/);
    await expect(page.locator('select[name="sort"]')).toHaveValue("title");
  });

  test("status pada URL tidak membuka konten non-disetujui", async ({
    page,
  }) => {
    await page.goto("/wilayah/konten?status=SUBMITTED&source=EDUFAST");
    await expect(
      page.getByText(/hanya status Disetujui yang ditampilkan/i),
    ).toBeVisible();
    await expect(page.locator('select[name="status"]')).toHaveCount(0);
  });
});

test.describe("Konten disetujui cabang", () => {
  test.use({ storageState: BRANCH_STATE });

  test("menampilkan tabel approved dengan filter jenis konten", async ({
    page,
  }) => {
    await page.goto("/cabang/konten");
    await expect(
      page.getByRole("heading", { name: "Konten disetujui", level: 1 }),
    ).toBeVisible();
    await expect(page.locator('select[name="type"]')).toBeVisible();
    await expect(page.locator('select[name="source"]')).toBeVisible();
  });
});

test.describe("Batas peran halaman Konten", () => {
  test.use({ storageState: CLIENT_STATE });

  test("stakeholder tidak dapat membuka Konten wilayah", async ({ page }) => {
    await page.goto("/wilayah/konten");
    await page.waitForURL(/akses-ditolak/);
  });
});
