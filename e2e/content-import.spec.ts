import { expect, request as playwrightRequest, test } from "@playwright/test";

import { ADMIN_STATE, baseURL } from "./support";

test.describe("Impor konten massal (Master Admin)", () => {
  test.use({ storageState: ADMIN_STATE });

  test("menampilkan panduan, template CSV, dan penjagaan mode demo", async ({
    page,
  }) => {
    await page.goto("/admin/konten/impor");
    await expect(
      page.getByRole("heading", { name: "Impor konten massal", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cara penggunaan" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Mode demo: impor konten dinonaktifkan agar data demo tetap terkendali.",
        { exact: true },
      ),
    ).toBeVisible();

    const context = await playwrightRequest.newContext({
      baseURL,
      storageState: ADMIN_STATE,
    });
    try {
      const template = await context.fetch(
        "/api/v1/admin/imports/content/template",
      );
      expect(template.status()).toBe(200);
      expect(template.headers()["content-type"]).toContain("text/csv");
      expect(template.headers()["content-disposition"]).toContain(
        'attachment; filename="template-impor-konten.csv"',
      );
      expect(template.headers()["x-import-headers"]).toContain("organisasi");
      const body = await template.text();
      expect(body.replace(/^\uFEFF/, "").split(/\r?\n/)[0]).toContain(
        "organisasi,judul,tautan,platform,jenis_konten,tema_utama,sub_tema,narasi,tanggal_konten,tanggal_terbit,lintang,bujur,lokasi",
      );

      const preview = await context.fetch(
        "/api/v1/admin/imports/content/preview",
        {
          method: "POST",
          data: { filename: "demo.csv", content: "organisasi,judul\n" },
        },
      );
      expect(preview.status()).toBe(403);
      const payload = (await preview.json()) as {
        error?: { message?: string };
      };
      expect(payload.error?.message).toContain(
        "Akun demo tidak dapat mengimpor konten",
      );
    } finally {
      await context.dispose();
    }
  });
});
