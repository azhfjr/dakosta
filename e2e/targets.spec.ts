import { expect, test } from "@playwright/test";

import { ADMIN_STATE, CLIENT_STATE } from "./support";

const SUBTHEME_SCOPE = "Tema Mobile JKN";

test.describe("Target KPI Master", () => {
  test.use({ storageState: ADMIN_STATE });

  test("demo Master melihat target tanpa kontrol perubahan", async ({
    page,
  }) => {
    await page.goto("/admin/target");
    await expect(
      page.getByRole("heading", { name: "Target periode", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(/Mode demo: penetapan dan perubahan target dinonaktifkan/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tambah target" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Ubah target/ })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: /Hapus target/ }),
    ).toHaveCount(0);

    const row = page.getByRole("row", { name: new RegExp(SUBTHEME_SCOPE) });
    await expect(row).toBeVisible();

    const achievementLink = row.getByRole("link", { name: "Lihat capaian" });
    await expect(achievementLink).toHaveAttribute(
      "href",
      /subTheme=MOBILE_JKN/,
    );
    await achievementLink.click();
    await expect(page).toHaveURL(/\/admin\?.*subTheme=MOBILE_JKN/);
    await expect(page.locator('select[name="subTheme"]')).toHaveValue(
      "MOBILE_JKN",
    );
  });
});

test.describe("Akun Master", () => {
  test.use({ storageState: ADMIN_STATE });

  test("pembuatan akun dinonaktifkan pada mode demo", async ({ page }) => {
    await page.goto("/admin/akun");
    await expect(
      page.getByRole("heading", { name: "Akun & akses", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(/Mode demo: pembuatan dan perubahan akun dinonaktifkan/),
    ).toBeVisible();
    await expect(page.locator("#acct-name")).toBeHidden();
    await expect(page.getByRole("button", { name: "Buat akun" })).toBeHidden();
  });
});

test.describe("Target dan stakeholder", () => {
  test.use({ storageState: CLIENT_STATE });

  test("stakeholder tidak dapat membuka pengelolaan target", async ({
    page,
  }) => {
    await page.goto("/admin/target");
    await expect(page).toHaveURL(/\/(akses-ditolak|client)/);
  });
});
