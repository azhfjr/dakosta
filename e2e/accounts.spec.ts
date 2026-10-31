import { expect, test } from "@playwright/test";

import { demoPassword } from "./demo-password";
import { ADMIN_STATE } from "./support";

const DEMO_ACCOUNT_MESSAGE = "Akun demo tidak dapat mengubah akun";

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

  test("direktori akun demo bersifat baca-saja", async ({ page }) => {
    await page.goto("/admin/akun");
    await expect(
      page.getByRole("heading", { name: "Akun & akses", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(/Mode demo: pembuatan dan perubahan akun dinonaktifkan/),
    ).toBeVisible();
    await expect(page.locator("#acct-name")).toBeHidden();

    const create = await page.request.post("/api/v1/admin/users", { data: {} });
    expect(create.status()).toBe(403);
    const body = (await create.json()) as { error?: { message?: string } };
    expect(body.error?.message).toContain(DEMO_ACCOUNT_MESSAGE);
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
    expect(demote.status()).toBe(403);
    const demoteBody = (await demote.json()) as { error?: { message?: string } };
    expect(demoteBody.error?.message).toContain(DEMO_ACCOUNT_MESSAGE);

    const suspend = await page.request.patch(
      `/api/v1/admin/users/${identity.data.id}`,
      { data: { status: "SUSPENDED" } },
    );
    expect(suspend.status()).toBe(403);
    const suspendBody = (await suspend.json()) as { error?: { message?: string } };
    expect(suspendBody.error?.message).toContain(DEMO_ACCOUNT_MESSAGE);

    const after = await page.request.get("/api/v1/me");
    const stillMaster = (await after.json()) as { data: { role: string } };
    expect(stillMaster.data.role).toBe("MASTER_ADMIN");
  });
});
