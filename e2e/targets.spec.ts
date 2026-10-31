import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

import { demoPassword } from "./demo-password";
import { ADMIN_STATE, CLIENT_STATE } from "./support";

const TARGET_SCOPE = "Klinik Sehat Nusantara · Informasi";

async function confirmStepUp(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Konfirmasi kata sandi" });
  await expect(dialog).toBeVisible();
  await dialog.locator("#step-up-password").fill(demoPassword());
  await dialog.getByRole("button", { name: "Konfirmasi" }).click();
  await expect(dialog).toBeHidden();
}

async function openCreateDialog(page: Page) {
  await page.goto("/admin/target");
  await expect(
    page.getByRole("heading", { name: "Target periode", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tambah target" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Tambah target" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Target KPI Master", () => {
  test.use({ storageState: ADMIN_STATE });

  test("Master menambah, menolak duplikat, mengubah, dan menghapus target", async ({
    page,
  }) => {
    const dialog = await openCreateDialog(page);
    await dialog.locator("#target-stakeholder").selectOption({
      label: "Klinik Sehat Nusantara",
    });
    await dialog.locator("#target-subtheme").selectOption({ label: "Informasi" });
    await dialog.locator("#target-count").fill("5");
    await dialog.getByRole("button", { name: "Tambah target" }).click();
    await confirmStepUp(page);

    await expect(page.getByText("Target ditambahkan.", { exact: true })).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(TARGET_SCOPE) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("5");

    const duplicate = await openCreateDialog(page);
    await duplicate.locator("#target-stakeholder").selectOption({
      label: "Klinik Sehat Nusantara",
    });
    await duplicate.locator("#target-subtheme").selectOption({ label: "Informasi" });
    await duplicate.locator("#target-count").fill("9");
    await duplicate.getByRole("button", { name: "Tambah target" }).click();
    await expect(
      page.getByText(/Target untuk cakupan dan periode ini sudah ada/),
    ).toBeVisible();
    await duplicate.getByRole("button", { name: "Batal" }).click();

    await page.getByRole("button", { name: `Ubah target ${TARGET_SCOPE}` }).click();
    const editDialog = page.getByRole("dialog", { name: "Ubah target" });
    await editDialog.locator("#target-count").fill("7");
    await editDialog.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(page.getByText("Target diperbarui.", { exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(TARGET_SCOPE) })).toContainText(
      "7",
    );

    const achievementLink = page
      .getByRole("row", { name: new RegExp(TARGET_SCOPE) })
      .getByRole("link", { name: "Lihat capaian" });
    await expect(achievementLink).toHaveAttribute("href", /subTheme=INFORMASI/);
    await achievementLink.click();
    await expect(page).toHaveURL(/\/admin\?.*subTheme=INFORMASI/);
    await expect(page.locator('select[name="subTheme"]')).toHaveValue("INFORMASI");

    await page.goto("/admin/target");
    await page.getByRole("button", { name: `Hapus target ${TARGET_SCOPE}` }).click();
    const confirm = page.getByRole("alertdialog", { name: "Hapus target ini?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Hapus target" }).click();
    await expect(page.getByText("Target dihapus.", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("row", { name: new RegExp(TARGET_SCOPE) }),
    ).toHaveCount(0);
  });
});

test.describe("Akun Master", () => {
  test.use({ storageState: ADMIN_STATE });

  test("Master membuat akun baru dengan konfirmasi kata sandi sekali jalan", async ({
    page,
  }) => {
    const email = `uji.akun.${randomUUID().slice(0, 8)}@example.test`;
    await page.goto("/admin/akun");
    await expect(
      page.getByRole("heading", { name: "Akun & akses", level: 1 }),
    ).toBeVisible();

    await page.locator("#acct-name").fill("Akun Uji Otomatis");
    await page.locator("#acct-email").fill(email);
    await page.locator("#acct-org").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Buat akun" }).click();
    await confirmStepUp(page);

    await expect(
      page.getByRole("heading", {
        name: "Kata sandi sementara untuk Akun Uji Otomatis",
      }),
    ).toBeVisible();
    await page.getByPlaceholder("Cari nama, email, lingkup").fill(email);
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });
});

test.describe("Target dan stakeholder", () => {
  test.use({ storageState: CLIENT_STATE });

  test("stakeholder tidak dapat membuka pengelolaan target", async ({ page }) => {
    await page.goto("/admin/target");
    await expect(page).toHaveURL(/\/(akses-ditolak|client)/);
  });
});
