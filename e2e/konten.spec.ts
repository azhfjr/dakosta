import { expect, test } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

const ROLES = [
  {
    name: "master",
    path: "/admin/konten",
    state: ADMIN_STATE,
    hasOrganizationColumn: true,
  },
  {
    name: "wilayah",
    path: "/wilayah/konten",
    state: REGIONAL_STATE,
    hasOrganizationColumn: true,
  },
  {
    name: "cabang",
    path: "/cabang/konten",
    state: BRANCH_STATE,
    hasOrganizationColumn: true,
  },
  {
    name: "stakeholder",
    path: "/client/konten",
    state: CLIENT_STATE,
    hasOrganizationColumn: false,
  },
] as const;

const TABLE_LABEL = "Tabel detail konten, dapat digulir";

test.describe("Detail konten seluruh peran", () => {
  for (const role of ROLES) {
    test(`${role.name}: empat status kanonik, header dapat disortir, tanpa kolom keputusan`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ storageState: role.state });
      try {
        const page = await context.newPage();
        await page.goto(role.path);
        await expect(
          page.getByRole("heading", { name: "Detail Konten", level: 1 }),
        ).toBeVisible({ timeout: 30_000 });

        const filter = page.getByRole("region", {
          name: "Filter detail konten",
        });
        await expect(filter.locator("summary")).toHaveCount(0);
        expect(
          await filter
            .locator('select[name="status"] option')
            .allTextContents(),
        ).toEqual([
          "Semua status",
          "Draf",
          "Terkirim",
          "Perlu Revisi",
          "Disetujui",
        ]);

        const table = page.getByRole("region", { name: TABLE_LABEL });
        await expect(table).toBeVisible();
        for (const label of [
          "Kode",
          "Judul",
          "Jenis",
          "Platform",
          "Status",
          "Dibuat",
          "Disetujui",
        ]) {
          await expect(
            table.getByRole("columnheader", { name: label }),
          ).toBeVisible();
        }
        if (role.hasOrganizationColumn) {
          await expect(
            table.getByRole("columnheader", { name: "Organisasi" }),
          ).toBeVisible();
        } else {
          await expect(
            table.getByRole("columnheader", { name: "Organisasi" }),
          ).toHaveCount(0);
        }
        await expect(
          table.getByRole("columnheader", { name: "Keputusan" }),
        ).toHaveCount(0);

        await expect(
          table.getByRole("columnheader", { name: "Kode" }),
        ).toHaveAttribute("aria-sort", /^(none|ascending|descending)$/);

        const csvHref = await page
          .getByRole("link", { name: "Ekspor CSV" })
          .getAttribute("href");
        expect(csvHref).toMatch(/^\/api\/v1\/exports\/submissions\?mode=all/);
        expect(csvHref).not.toContain("page=");
        expect(csvHref).not.toContain("sort=");
        await expect(
          page.getByRole("link", { name: "Unduh PDF" }),
        ).toHaveAttribute("href", /^\/api\/v1\/reports\/contents\?mode=all/);
      } finally {
        await context.close();
      }
    });
  }
});

test.describe("Detail konten master", () => {
  test.use({ storageState: ADMIN_STATE });

  test("status URL menyaring tabel dan keputusan menyatu di sel status", async ({
    page,
  }) => {
    await page.goto("/admin/konten?status=APPROVED");
    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await expect(filter.locator('select[name="status"]')).toHaveValue(
      "APPROVED",
    );
    await expect(page.getByText(/konten sesuai filter/i).first()).toBeVisible();

    const table = page.getByRole("region", { name: TABLE_LABEL });
    const rows = table.locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(rows.first()).toContainText("Disetujui");
    await expect(rows.first().getByText(/oleh /i)).toBeVisible();
  });

  test("ekspor mengikuti seluruh filter aktif, bukan hanya halaman ini", async ({
    page,
  }) => {
    await page.goto("/admin/konten?status=SUBMITTED&page=2");
    await expect(
      page.getByRole("region", { name: "Filter detail konten" }),
    ).toBeVisible({ timeout: 30_000 });

    const csvHref = await page
      .getByRole("link", { name: "Ekspor CSV" })
      .getAttribute("href");
    expect(csvHref).toContain("status=SUBMITTED");
    expect(csvHref).toContain("mode=all");
    expect(csvHref).not.toContain("page=");
    await expect(page.getByRole("link", { name: "Unduh PDF" })).toHaveAttribute(
      "href",
      /status=SUBMITTED/,
    );
  });
});

test.describe("Batas peran halaman Konten", () => {
  test.use({ storageState: CLIENT_STATE });

  test("stakeholder tidak dapat membuka Konten wilayah", async ({ page }) => {
    await page.goto("/wilayah/konten");
    await page.waitForURL(/akses-ditolak/);
  });
});
