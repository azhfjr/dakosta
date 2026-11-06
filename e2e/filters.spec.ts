import { expect, test } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

test.describe("Filter konten admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test("dropdown status, stakeholder, dan sub-tema mengubah URL serta tabel", async ({
    page,
  }) => {
    await page.goto("/admin/konten");
    const filter = page.getByRole("region", { name: "Filter konten" });
    await expect(filter).toBeVisible();
    await expect(filter.locator("select")).toHaveCount(3);

    await filter.locator('select[name="status"]').selectOption("APPROVED");
    await page.waitForURL(/status=APPROVED/);
    await expect(filter.locator('select[name="status"]')).toHaveValue(
      "APPROVED",
    );
    await expect(
      page.getByRole("heading", { name: "Konten Disetujui" }),
    ).toBeVisible();

    await filter.locator('select[name="subTheme"]').selectOption({ index: 1 });
    await page.waitForURL(/subTheme=/);
    await expect(filter.locator('select[name="subTheme"]')).not.toHaveValue("");
    await expect(filter.locator('select[name="status"]')).toHaveValue(
      "APPROVED",
    );
  });

  test("atur ulang mengembalikan seluruh filter", async ({ page }) => {
    await page.goto("/admin/konten?status=SUBMITTED");
    const filter = page.getByRole("region", { name: "Filter konten" });
    await expect(filter.locator('select[name="status"]')).toHaveValue(
      "SUBMITTED",
    );

    await filter.getByRole("link", { name: "Atur ulang" }).click();
    await page.waitForURL(/\/admin\/konten$/);
    await expect(filter.locator('select[name="status"]')).toHaveValue("");
  });

  test("filter antrean validasi memakai dropdown status", async ({ page }) => {
    await page.goto("/admin/validasi");
    const filter = page.getByRole("region", { name: "Filter antrean" });
    await expect(filter.locator('select[name="status"]')).toBeVisible();
    await expect(filter.locator('input[name="q"]')).toBeVisible();

    await filter.locator('select[name="status"]').selectOption("SUBMITTED");
    await page.waitForURL(/status=SUBMITTED/);
    await expect(filter.locator('select[name="status"]')).toHaveValue(
      "SUBMITTED",
    );
  });
});

test.describe("Filter konten wilayah", () => {
  test.use({ storageState: REGIONAL_STATE });

  test("hanya menampilkan filter yang relevan dan tidak ada filter status", async ({
    page,
  }) => {
    await page.goto("/wilayah/konten");
    const filter = page.getByRole("region", {
      name: "Filter konten disetujui",
    });
    await expect(filter.locator('select[name="status"]')).toHaveCount(0);
    await expect(filter.locator('select[name="stakeholderId"]')).toHaveCount(0);
    await expect(filter.locator('select[name="period"]')).toBeVisible();
    await expect(filter.locator('select[name="source"]')).toBeVisible();
    await expect(filter.locator('select[name="subTheme"]')).toBeVisible();
    await expect(filter.locator('select[name="type"]')).toBeVisible();
    await expect(filter.locator('select[name="sort"]')).toBeVisible();
  });

  test("mempertahankan stakeholderId tersembunyi saat filter diubah", async ({
    page,
  }) => {
    await page.goto("/wilayah/konten");
    const filter = page.getByRole("region", {
      name: "Filter konten disetujui",
    });
    await filter.locator('select[name="sort"]').selectOption("title");
    await page.waitForURL(/sort=title/);
    await expect(filter.locator('select[name="sort"]')).toHaveValue("title");
  });
});

test.describe("Filter konten cabang", () => {
  test.use({ storageState: BRANCH_STATE });

  test("menampilkan filter sumber dan jenis konten", async ({ page }) => {
    await page.goto("/cabang/konten");
    const filter = page.getByRole("region", {
      name: "Filter konten disetujui",
    });
    await expect(filter.locator('select[name="status"]')).toHaveCount(0);
    await expect(filter.locator('select[name="source"]')).toBeVisible();
    await expect(filter.locator('select[name="type"]')).toBeVisible();

    await filter.locator('select[name="type"]').selectOption({ index: 1 });
    await page.waitForURL(/type=/);
    await expect(filter.locator('select[name="type"]')).not.toHaveValue("");
  });
});

test.describe("Filter konten stakeholder", () => {
  test.use({ storageState: CLIENT_STATE });

  test("status, sub-tema, dan sortir memakai dropdown", async ({ page }) => {
    await page.goto("/client/konten");
    const filter = page.getByRole("region", { name: "Filter konten" });
    await expect(filter.locator('select[name="status"]')).toBeVisible();
    await expect(filter.locator('select[name="subTheme"]')).toBeVisible();

    await filter.locator('select[name="sort"]').selectOption("title");
    await page.waitForURL(/sort=title/);
    await expect(filter.locator('select[name="sort"]')).toHaveValue("title");
  });
});

test.describe("Filter dasbor", () => {
  test.use({ storageState: ADMIN_STATE });

  test("satu filter bar dengan periode, stakeholder, sub-tema, dan dasar tanggal", async ({
    page,
  }) => {
    await page.goto("/admin");
    const filter = page.getByRole("region", { name: "Filter dasbor" });
    await expect(filter).toBeVisible();
    await expect(filter.locator('select[name="period"]')).toBeVisible();
    await expect(filter.locator('select[name="stakeholderId"]')).toBeVisible();
    await expect(filter.locator('select[name="subTheme"]')).toBeVisible();
    await expect(filter.locator('select[name="attribution"]')).toBeVisible();

    await filter.locator('select[name="subTheme"]').selectOption({ index: 1 });
    await page.waitForURL(/subTheme=/);
    await expect(filter.locator('select[name="subTheme"]')).not.toHaveValue("");
  });
});
