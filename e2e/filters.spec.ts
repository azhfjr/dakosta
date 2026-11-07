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

test.describe("Filter tabel dashboard", () => {
  test.use({ storageState: ADMIN_STATE });

  test("satu filter bar disetujui untuk instansi, cabang, tema, jenis, dan platform", async ({
    page,
  }) => {
    await page.goto("/admin");
    const filter = page.getByRole("region", {
      name: "Filter konten disetujui",
    });
    await expect(filter).toBeVisible();
    for (const name of [
      "q",
      "stakeholderId",
      "branchId",
      "orgType",
      "mainTheme",
      "subTheme",
      "type",
      "platform",
    ]) {
      await expect(filter.locator(`[name="${name}"]`)).toBeVisible();
    }

    await filter.locator('select[name="subTheme"]').selectOption({ index: 1 });
    await page.waitForURL(/subTheme=/);
    await expect(filter.locator('select[name="subTheme"]')).not.toHaveValue("");
  });
});
