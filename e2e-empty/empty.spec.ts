import { expect, test } from "@playwright/test";

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
      let response = await page.goto(route, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.locator("h1").first(), route).toBeVisible({
        timeout: 30_000,
      });
      if (!response) {
        // Turbopack can trigger one full reload while compiling a route for the
        // first time, which makes the first goto resolve without a response.
        response = await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("h1").first(), route).toBeVisible({
          timeout: 30_000,
        });
      }
      expect(response?.status(), route).toBeLessThan(500);
    }

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: /Ringkasan|Dashboard/i }).first(),
    ).toBeVisible();

    await page.goto("/admin/target");
    await expect(
      page.getByText("Belum ada target untuk periode ini"),
    ).toBeVisible();

    await page.goto("/admin/wilayah");
    await expect(page.getByText("Belum ada wilayah terdaftar")).toBeVisible();
  });

  test("Master melihat hierarki kosong dengan perubahan dinonaktifkan", async ({
    page,
  }) => {
    test.slow();
    await page.goto("/admin/wilayah");
    await expect(page.getByText("Belum ada wilayah terdaftar")).toBeVisible();
    await expect(
      page.getByText(
        /Mode demo: perubahan wilayah, cabang, dan organisasi dinonaktifkan/,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tambah wilayah" }),
    ).toHaveCount(0);

    await page.goto("/admin/akun");
    await expect(
      page.getByText(/Mode demo: pembuatan dan perubahan akun dinonaktifkan/),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Buat akun" })).toHaveCount(
      0,
    );
  });

  test("Dashboard kosong menampilkan angka nol dan empty state jujur", async ({
    page,
  }) => {
    test.slow();
    await page.goto("/admin");

    await expect(page.locator("#ringkasan")).toContainText(
      "Total Konten Tervalidasi",
    );
    await expect(page.locator("#ringkasan")).toContainText("0 dari 0 cabang");
    await expect(page.locator("#ringkasan")).toContainText(
      "Belum terhubung ke cabang.",
    );
    await expect(page.locator("#konten-per-cabang")).toContainText(
      "Belum ada cabang dalam cakupan Anda.",
    );
    await expect(page.locator("#pilih-cabang")).toContainText(
      "Tidak ada cabang dalam cakupan Anda",
    );
    await expect(page.locator("#fktp")).toContainText(
      "Belum ada konten tervalidasi pada kategori ini.",
    );
    await expect(page.locator("#peta")).toContainText(
      "Belum ada konten tervalidasi dengan lokasi",
    );
    await expect(page.locator("#edufast")).toContainText("Konten EDUFAST");
    await expect(page.locator("#tema-konten")).toContainText(
      "Belum ada konten Non-EDUFAST",
    );
  });
});
