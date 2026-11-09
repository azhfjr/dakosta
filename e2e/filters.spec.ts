import { expect, test } from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
} from "./support";

const STATUS_LABELS = [
  "Semua status",
  "Draf",
  "Terkirim",
  "Perlu Revisi",
  "Disetujui",
] as const;

const CONTENT_ROLES = [
  {
    name: "master",
    path: "/admin/konten",
    state: ADMIN_STATE,
    hasStakeholderFilter: true,
  },
  {
    name: "wilayah",
    path: "/wilayah/konten",
    state: REGIONAL_STATE,
    hasStakeholderFilter: true,
  },
  {
    name: "cabang",
    path: "/cabang/konten",
    state: BRANCH_STATE,
    hasStakeholderFilter: false,
  },
  {
    name: "stakeholder",
    path: "/client/konten",
    state: CLIENT_STATE,
    hasStakeholderFilter: false,
  },
] as const;

test.describe("Filter detail konten terpadu", () => {
  test.use({ storageState: ADMIN_STATE });

  for (const role of CONTENT_ROLES) {
    test(`${role.name}: satu panel filter tanpa filter lanjutan dan tanpa jenis organisasi`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ storageState: role.state });
      try {
        const page = await context.newPage();
        await page.goto(role.path);
        const filter = page.getByRole("region", {
          name: "Filter detail konten",
        });
        await expect(filter).toBeVisible({ timeout: 30_000 });

        const controls = [
          "q",
          "status",
          "mainTheme",
          "subTheme",
          "type",
          "platform",
          "from",
          "to",
        ];
        if (role.hasStakeholderFilter) controls.push("stakeholderId");
        for (const name of controls) {
          await expect(filter.locator(`[name="${name}"]`)).toBeVisible();
        }

        await expect(filter.locator('[name="orgType"]')).toHaveCount(0);
        await expect(filter.locator('[name="period"]')).toHaveCount(0);
        await expect(filter.locator('[name="sort"]')).toHaveCount(0);
        await expect(filter.locator("summary")).toHaveCount(0);
        await expect(filter.getByText("Filter lanjutan")).toHaveCount(0);

        expect(
          await filter
            .locator('select[name="status"] option')
            .allTextContents(),
        ).toEqual([...STATUS_LABELS]);

        await filter.locator('select[name="status"]').selectOption("APPROVED");
        await page.waitForURL(/status=APPROVED/);
        await expect(filter.locator('select[name="status"]')).toHaveValue(
          "APPROVED",
        );
      } finally {
        await context.close();
      }
    });
  }

  test("master: status dan sub-tema bertahan bersamaan di URL", async ({
    page,
  }) => {
    await page.goto("/admin/konten");
    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await expect(filter).toBeVisible({ timeout: 30_000 });

    await filter
      .locator('select[name="status"]')
      .selectOption("REVISION_REQUIRED");
    await page.waitForURL(/status=REVISION_REQUIRED/);

    await filter.locator('select[name="subTheme"]').selectOption({ index: 1 });
    await page.waitForURL(/subTheme=/);

    const url = new URL(page.url());
    expect(url.searchParams.get("status")).toBe("REVISION_REQUIRED");
    expect(url.searchParams.get("subTheme")).toBeTruthy();
    expect(url.searchParams.get("mode")).toBe("all");
  });

  test("status legacy pada URL dipetakan ke status kanonik", async ({
    page,
  }) => {
    const cases = [
      ["IN_REVIEW", "SUBMITTED"],
      ["RESUBMITTED", "SUBMITTED"],
      ["REJECTED", "REVISION_REQUIRED"],
      ["REVOKED", "REVISION_REQUIRED"],
      ["ARCHIVED", "APPROVED"],
    ] as const;

    for (const [legacy, canonical] of cases) {
      await page.goto(`/admin/konten?status=${legacy}`);
      const filter = page.getByRole("region", {
        name: "Filter detail konten",
      });
      await expect(filter.locator('select[name="status"]')).toHaveValue(
        canonical,
      );
      await expect(page.locator(`option[value="${legacy}"]`)).toHaveCount(0);
    }
  });

  test("parameter lama orgType dan period tidak merusak halaman", async ({
    page,
  }) => {
    await page.goto("/admin/konten?orgType=FASKES&period=2026-01");
    const filter = page.getByRole("region", { name: "Filter detail konten" });
    await expect(filter).toBeVisible({ timeout: 30_000 });
    await expect(filter.locator('[name="orgType"]')).toHaveCount(0);
    await expect(filter.locator('[name="period"]')).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Detail Konten", level: 1 }),
    ).toBeVisible();
  });
});

test.describe("Sortir detail konten lewat header kolom", () => {
  test.use({ storageState: ADMIN_STATE });

  test("header mengubah URL, arah, dan mengembalikan halaman ke awal", async ({
    page,
  }) => {
    await page.goto("/admin/konten?page=2");
    const table = page.getByRole("region", {
      name: "Tabel detail konten, dapat digulir",
    });
    await expect(table).toBeVisible({ timeout: 30_000 });

    const titleHeader = table.getByRole("columnheader", { name: "Judul" });
    await expect(titleHeader).toHaveAttribute("aria-sort", "none");

    await titleHeader.getByRole("link", { name: "Judul" }).click();
    await page.waitForURL(/sort=title/);
    let url = new URL(page.url());
    expect(url.searchParams.get("sort")).toBe("title");
    expect(url.searchParams.get("direction")).toBe("asc");
    expect(url.searchParams.has("page")).toBe(false);
    await expect(
      page.getByRole("columnheader", { name: "Judul" }),
    ).toHaveAttribute("aria-sort", "ascending");

    await page
      .getByRole("columnheader", { name: "Judul" })
      .getByRole("link")
      .click();
    await page.waitForURL(/direction=desc/);
    url = new URL(page.url());
    expect(url.searchParams.get("direction")).toBe("desc");
    await expect(
      page.getByRole("columnheader", { name: "Judul" }),
    ).toHaveAttribute("aria-sort", "descending");
  });

  test("sortir status memakai arah bawaan dan tetap dapat dibalik", async ({
    page,
  }) => {
    await page.goto("/admin/konten");
    const statusHeader = page.getByRole("columnheader", { name: "Status" });
    await statusHeader.getByRole("link", { name: "Status" }).click();
    await page.waitForURL(/sort=status/);
    const url = new URL(page.url());
    expect(url.searchParams.get("sort")).toBe("status");
    expect(url.searchParams.get("direction")).toBe("desc");
    await expect(
      page.getByRole("columnheader", { name: "Status" }),
    ).toHaveAttribute("aria-sort", "descending");
  });
});

test.describe("Filter antrean SLA", () => {
  test.use({ storageState: ADMIN_STATE });

  test("filter antrean memakai satu panel terpadu dengan jenis organisasi", async ({
    page,
  }) => {
    await page.goto("/admin/validasi");
    const filter = page.getByRole("region", { name: "Filter antrean" });
    await expect(filter).toBeVisible({ timeout: 30_000 });

    for (const name of [
      "status",
      "orgType",
      "mainTheme",
      "subTheme",
      "period",
      "q",
    ]) {
      await expect(filter.locator(`[name="${name}"]`)).toBeVisible();
    }
    await expect(filter.locator("summary")).toHaveCount(0);
    await expect(filter.getByText("Filter lanjutan")).toHaveCount(0);
    await expect(
      filter.locator('select[name="status"] option[value="ALL"]'),
    ).toHaveCount(1);
    await expect(
      filter.locator('select[name="status"] option[value="SUBMITTED"]'),
    ).toHaveCount(1);

    await filter.locator('select[name="status"]').selectOption("SUBMITTED");
    await page.waitForURL(/status=SUBMITTED/);
    await expect(filter.locator('select[name="status"]')).toHaveValue(
      "SUBMITTED",
    );
  });
});

test.describe("Filter kinerja tanpa batas numerik", () => {
  test.use({ storageState: ADMIN_STATE });

  test("filter utama menyatu dan parameter numerik lama diabaikan", async ({
    page,
  }) => {
    await page.goto(
      "/admin/laporan?approvedMin=5&approvedMax=90&realizedMin=2&realizedMax=80&targetMin=1&targetMax=50&percentMin=10&percentMax=100",
    );
    const filter = page.getByRole("region", { name: "Filter kinerja" });
    await expect(filter).toBeVisible({ timeout: 30_000 });

    for (const name of ["period", "branch", "type", "status", "q"]) {
      await expect(filter.locator(`[name="${name}"]`)).toBeVisible();
    }
    for (const removed of [
      "approvedMin",
      "approvedMax",
      "realizedMin",
      "realizedMax",
      "targetMin",
      "targetMax",
      "percentMin",
      "percentMax",
    ]) {
      await expect(filter.locator(`[name="${removed}"]`)).toHaveCount(0);
    }
    await expect(filter.locator('input[type="number"]')).toHaveCount(0);
    await expect(filter.locator("summary")).toHaveCount(0);
    await expect(filter.getByText("Filter lanjutan")).toHaveCount(0);

    expect(
      await filter.locator('select[name="status"] option').allTextContents(),
    ).toEqual([
      "Semua status",
      "Tercapai",
      "Di bawah target",
      "Target belum ditetapkan",
    ]);

    await filter.locator('select[name="status"]').selectOption("BELOW");
    await page.waitForURL(/status=BELOW/);
    await expect(
      page.getByRole("region", { name: "Tabel kinerja" }),
    ).toBeVisible();
  });

  test("tabel kinerja memakai header sortir yang sama", async ({ page }) => {
    await page.goto("/admin/laporan");
    const table = page.getByRole("region", { name: "Tabel kinerja" });
    await expect(table).toBeVisible({ timeout: 30_000 });
    const instansi = table.getByRole("columnheader", { name: "Instansi" });
    await expect(instansi).toHaveAttribute(
      "aria-sort",
      /^(none|ascending|descending)$/,
    );
    await instansi.getByRole("link", { name: "Instansi" }).click();
    await page.waitForURL(/sort=name/);
    await expect(
      table.getByRole("columnheader", { name: "Instansi" }),
    ).toHaveAttribute("aria-sort", "ascending");
  });
});

test.describe("Filter cabang dashboard", () => {
  test.use({ storageState: ADMIN_STATE });

  test("checklist cabang memakai parameter berulang dan menyimpan filter lain", async ({
    page,
  }) => {
    await page.goto("/admin?view=tema-konten");
    const checklist = page.locator("#pilih-cabang");
    await expect(
      checklist.getByRole("heading", { name: "Cabang", exact: true }),
    ).toBeVisible();

    await checklist.locator("summary").click();
    const branch = checklist.locator('input[id^="cabang-"]').first();
    await expect(branch).toBeVisible();
    await branch.click();
    await page.waitForURL(/cabang=/);

    const url = new URL(page.url());
    await expect.poll(() => new URL(page.url()).hash).toBe("#tema-konten");
    expect(url.searchParams.getAll("cabang").length).toBeGreaterThan(0);
    await expect(page.locator("#tema-konten")).toBeVisible();
  });

  test("dropdown wilayah memilih seluruh cabang wilayah dan dapat direset", async ({
    page,
  }) => {
    await page.goto("/admin#tema-konten");
    const checklist = page.locator("#pilih-cabang");
    const regionSelect = checklist.getByLabel("Wilayah");
    await expect(regionSelect).toBeVisible();
    await expect(regionSelect).toHaveValue("all");
    // The branch popover only renders its list while open, so open it before
    // counting the branches grouped by region.
    await checklist.locator("summary").click();

    const regionOption = regionSelect.locator("option").nth(1);
    const regionValue = await regionOption.getAttribute("value");
    expect(regionValue).toMatch(/^region:/);
    const region = regionValue!.slice("region:".length);

    const expected = await checklist.evaluate((root, regionName) => {
      const groups = Array.from(
        root.querySelectorAll("[data-region]"),
      ) as HTMLElement[];
      const group = groups.find((item) => item.dataset.region === regionName);
      return group ? group.querySelectorAll('input[id^="cabang-"]').length : 0;
    }, region);
    expect(expected).toBeGreaterThan(0);

    await regionSelect.selectOption(regionValue!);
    await page.waitForURL(
      (url) => url.searchParams.getAll("cabang").length === expected,
    );
    const url = new URL(page.url());
    await expect.poll(() => new URL(page.url()).hash).toBe("#tema-konten");
    expect(url.searchParams.getAll("cabang")).toHaveLength(expected);
    await expect(regionSelect).toHaveValue(regionValue!);
    await expect(page.locator("#tema-konten")).toBeVisible();

    await regionSelect.selectOption("all");
    await page.waitForURL((target) => !target.searchParams.has("cabang"));
    await expect.poll(() => new URL(page.url()).hash).toBe("#tema-konten");
    await expect(checklist.locator("#pilih-semua-cabang")).toBeChecked();
  });
});
