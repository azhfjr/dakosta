import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

import { demoPassword } from "./demo-password";
import { ADMIN_STATE } from "./support";

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

test.describe("Direktori akun Master", () => {
  test.use({ storageState: ADMIN_STATE });

  test("filter peran menyaring direktori dan dapat diatur ulang", async ({ page }) => {
    const me = await page.request.get("/api/v1/me");
    expect(me.ok()).toBe(true);
    const identity = (await me.json()) as { data: { email: string } };

    await page.goto("/admin/akun");
    await expect(
      page.getByRole("heading", { name: "Akun & akses", level: 1 }),
    ).toBeVisible();

    await page.getByPlaceholder("Cari nama, email, lingkup").fill(identity.data.email);
    await expect(page.getByText(identity.data.email, { exact: true })).toBeVisible();

    await page.getByLabel("Filter peran").selectOption("STAKEHOLDER");
    await expect(
      page.getByText("Tidak ada akun yang cocok dengan filter ini."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Atur ulang filter" }).click();
    await expect(page.getByText(identity.data.email, { exact: true })).toBeVisible();
  });

  test("Master mengubah jabatan dan lingkup akun dengan konfirmasi kata sandi", async ({
    page,
  }) => {
    const email = `uji.ubah.${randomUUID().slice(0, 8)}@example.test`;
    await page.goto("/admin/akun");
    await page.locator("#acct-name").fill("Akun Uji Ubah");
    await page.locator("#acct-email").fill(email);
    await page.locator("#acct-org").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Buat akun" }).click();
    await confirmStepUpIfPrompted(page);
    await expect(
      page.getByRole("heading", { name: "Kata sandi sementara untuk Akun Uji Ubah" }),
    ).toBeVisible();

    const row = page.getByRole("row", { name: new RegExp(email) });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Ubah" }).click();

    const dialog = page.getByRole("dialog", { name: "Ubah akun" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#edit-name")).toHaveValue("Akun Uji Ubah");
    await dialog.locator("#edit-title").fill("Koordinator Uji");
    await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
    await confirmStepUpIfPrompted(page);

    await expect(page.getByText("Akun diperbarui. Sesi lama dicabut.")).toBeVisible();
    await page.getByPlaceholder("Cari nama, email, lingkup").fill(email);
    await expect(page.getByRole("row", { name: new RegExp(email) })).toContainText(
      "Koordinator Uji",
    );

    await page.getByRole("button", { name: "Tangguhkan" }).last().click();
    await confirmStepUpIfPrompted(page);
    await expect(page.getByText("Akun ditangguhkan.")).toBeVisible();
    await page.getByLabel("Filter status").selectOption("SUSPENDED");
    await expect(page.getByRole("row", { name: new RegExp(email) })).toBeVisible();
    await page.getByRole("button", { name: "Aktifkan" }).first().click();
    await confirmStepUpIfPrompted(page);
    await expect(page.getByText("Akun diaktifkan.")).toBeVisible();
  });
});

test.describe("Pengaman Master terakhir", () => {
  test.use({ storageState: ADMIN_STATE });

  test("akun Master aktif terakhir tidak dapat diturunkan atau ditangguhkan", async ({
    page,
  }) => {
    const me = await page.request.get("/api/v1/me");
    expect(me.ok()).toBe(true);
    const identity = (await me.json()) as {
      data: { id: string; role: string };
    };
    expect(identity.data.role).toBe("MASTER_ADMIN");

    const stepUp = await page.request.post("/api/v1/me/step-up", {
      data: { password: demoPassword() },
    });
    expect(stepUp.ok()).toBe(true);

    const demote = await page.request.patch(
      `/api/v1/admin/users/${identity.data.id}`,
      { data: { role: "STAKEHOLDER" } },
    );
    expect(demote.status()).not.toBe(200);

    const suspend = await page.request.patch(
      `/api/v1/admin/users/${identity.data.id}`,
      { data: { status: "SUSPENDED" } },
    );
    expect(suspend.status()).toBe(409);
    const suspendBody = (await suspend.json()) as { error?: { message?: string } };
    expect(suspendBody.error?.message).toMatch(/Master Admin aktif terakhir/);

    const after = await page.request.get("/api/v1/me");
    const stillMaster = (await after.json()) as { data: { role: string } };
    expect(stillMaster.data.role).toBe("MASTER_ADMIN");
  });
});
