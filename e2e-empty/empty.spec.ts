import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

import { demoPassword } from "../e2e/demo-password";

async function confirmStepUpIfPrompted(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Konfirmasi kata sandi" });
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;
  await dialog.locator("#step-up-password").fill(demoPassword());
  await dialog.getByRole("button", { name: "Konfirmasi" }).click();
  await expect(dialog).toBeHidden();
}

const ADMIN_PAGES = [
  "/admin",
  "/admin/akun",
  "/admin/analitik",
  "/admin/audit",
  "/admin/cabang",
  "/admin/edufast",
  "/admin/impor",
  "/admin/konten",
  "/admin/notifikasi",
  "/admin/organisasi",
  "/admin/pengguna",
  "/admin/peta",
  "/admin/red-notice",
  "/admin/target",
  "/admin/validasi",
  "/admin/wilayah",
];

test.describe("Basis data kosong", () => {
  test("seluruh halaman Master tampil tanpa galat server", async ({ page }) => {
    test.slow();
    for (const route of ADMIN_PAGES) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), route).toBeLessThan(500);
      await expect(page.locator("h1").first(), route).toBeVisible();
    }

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Ringkasan|Dashboard/i }).first()).toBeVisible();

    await page.goto("/admin/target");
    await expect(page.getByText("Belum ada target untuk periode ini")).toBeVisible();

    await page.goto("/admin/wilayah");
    await expect(page.getByText("Belum ada wilayah terdaftar")).toBeVisible();
  });

  test("Master menyiapkan hierarki pertama lalu akun stakeholder", async ({ page }) => {
    test.slow();
    const suffix = randomUUID().slice(0, 6).toUpperCase();

    await page.goto("/admin/wilayah");
    await page.getByRole("button", { name: "Tambah wilayah" }).click();
    const regionDialog = page.getByRole("dialog", { name: "Tambah wilayah" });
    await regionDialog.locator("#region-name").fill(`Wilayah Uji ${suffix}`);
    await regionDialog.locator("#region-code").fill(`W${suffix}`);
    await regionDialog.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText(`Wilayah Uji ${suffix}`)).toBeVisible();

    await page.goto("/admin/cabang");
    await page.getByRole("button", { name: "Tambah cabang" }).click();
    const branchDialog = page.getByRole("dialog", { name: "Tambah cabang" });
    await branchDialog.locator("#branch-name").fill(`Cabang Uji ${suffix}`);
    await branchDialog.locator("#branch-code").fill(`C${suffix}`);
    await branchDialog.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText(`Cabang Uji ${suffix}`)).toBeVisible();

    await page.goto("/admin/organisasi");
    await page.getByRole("button", { name: "Tambah organisasi" }).first().click();
    const orgDialog = page.getByRole("dialog", { name: "Tambah organisasi" });
    await orgDialog.locator("#org-name").fill(`Klinik Uji ${suffix}`);
    await orgDialog.locator("#org-code").fill(`F${suffix}`);
    await orgDialog.locator("#org-area").fill("Kota Bandung");
    await orgDialog.locator("#org-lat").fill("-6.9175");
    await orgDialog.locator("#org-lng").fill("107.6191");
    await orgDialog.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText(`Klinik Uji ${suffix}`)).toBeVisible();

    await page.goto("/admin/akun");
    const email = `stakeholder.${suffix.toLowerCase()}@example.test`;
    await page.locator("#acct-name").fill(`Stakeholder Uji ${suffix}`);
    await page.locator("#acct-email").fill(email);
    await page.locator("#acct-org").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Buat akun" }).click();
    await confirmStepUpIfPrompted(page);
    await expect(
      page.getByRole("heading", {
        name: `Kata sandi sementara untuk Stakeholder Uji ${suffix}`,
      }),
    ).toBeVisible();
  });

  test("Master menetapkan target pertama pada basis data kosong", async ({ page }) => {
    await page.goto("/admin/target");
    await page.getByRole("button", { name: "Tambah target" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tambah target" });
    await dialog.locator("#target-count").fill("10");
    await dialog.getByRole("button", { name: "Tambah target" }).click();
    await confirmStepUpIfPrompted(page);
    await expect(page.getByText("Target ditambahkan.", { exact: true })).toBeVisible();
    const row = page.getByRole("row", { name: /Workspace \(global\)/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("10");
  });
});
