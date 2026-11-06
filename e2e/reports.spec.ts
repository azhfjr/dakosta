import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
  baseURL,
  sameOriginHeaders,
} from "./support";

type ApiEnvelope<T> = {
  data?: T;
  error?: { code?: string; message?: string } | null;
};

type SyncResult = {
  month: string;
  created: number;
  updated: number;
  perSource: Array<{
    source: string;
    label: string;
    targetCount: number;
    organizations: number;
    created: number;
    updated: number;
  }>;
};

function jakartaMonth(offset = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function postJson<T>(
  context: APIRequestContext,
  path: string,
  data: unknown,
): Promise<{ status: number; body: ApiEnvelope<T>; text: string }> {
  const response = await context.post(path, {
    data,
    headers: sameOriginHeaders,
  });
  const text = await response.text();
  let body: ApiEnvelope<T> = {};
  try {
    body = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    body = {};
  }
  return { status: response.status(), body, text };
}

test.describe("Laporan Kinerja PDF", () => {
  test("Master mengunduh laporan Kinerja", async () => {
    const admin = await playwrightRequest.newContext({
      baseURL,
      storageState: ADMIN_STATE,
    });
    try {
      const month = jakartaMonth();
      const response = await admin.get(
        `/api/v1/reports/performance?period=${month}&pageSize=25`,
      );
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/pdf");
      expect(response.headers()["content-disposition"]).toContain(
        `attachment; filename="laporan-kinerja-${month}.pdf"`,
      );
      expect(response.headers()["cache-control"]).toContain("no-store");

      const buffer = Buffer.from(await response.body());
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
      expect(buffer.length).toBeGreaterThan(1_000);
    } finally {
      await admin.dispose();
    }
  });

  test("tautan PDF tersedia pada halaman Kinerja wilayah dan cabang", async ({
    browser,
  }) => {
    for (const [state, path] of [
      [REGIONAL_STATE, "/wilayah/kinerja"],
      [BRANCH_STATE, "/cabang/kinerja"],
    ] as const) {
      const context = await browser.newContext({ storageState: state });
      try {
        const page = await context.newPage();
        await page.goto(path);
        const link = page.getByRole("link", { name: "Unduh PDF" }).first();
        await expect(link).toBeVisible();
        const href = await link.getAttribute("href");
        expect(href).toMatch(
          /^\/api\/v1\/reports\/performance\?period=\d{4}-\d{2}/,
        );
      } finally {
        await context.close();
      }
    }
  });

  test("stakeholder tidak dapat mengunduh laporan Kinerja", async () => {
    const client = await playwrightRequest.newContext({
      baseURL,
      storageState: CLIENT_STATE,
    });
    try {
      const response = await client.get(
        `/api/v1/reports/performance?period=${jakartaMonth()}`,
      );
      expect(response.status()).toBe(403);
    } finally {
      await client.dispose();
    }
  });

  test("laporan tanpa sesi ditolak", async () => {
    const anonymous = await playwrightRequest.newContext({ baseURL });
    try {
      const response = await anonymous.get(
        `/api/v1/reports/performance?period=${jakartaMonth()}`,
      );
      expect(response.status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
  });
});

test.describe("Sinkronisasi target Master", () => {
  test.use({ storageState: ADMIN_STATE });

  test("panel sinkronisasi dinonaktifkan pada mode demo", async ({ page }) => {
    const month = jakartaMonth(-5);
    await page.goto(`/admin/target?month=${month}`);
    await expect(
      page.getByRole("heading", {
        name: "Sinkronisasi target semua organisasi",
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Mode demo: sinkronisasi target dinonaktifkan agar data demo tetap terkendali.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sinkronkan target" }),
    ).toHaveCount(0);
  });

  test("API menolak sinkronisasi dari Master demo", async () => {
    const admin = await playwrightRequest.newContext({
      baseURL,
      storageState: ADMIN_STATE,
    });
    try {
      const month = jakartaMonth(-5);
      const entries = [
        { source: "FASKES_FKTP", targetCount: 2 },
        { source: "FASKES_FKRTL", targetCount: 2 },
        { source: "PEMDA", targetCount: 2 },
        { source: "OTHER", targetCount: 2 },
      ];

      const denied = await postJson<SyncResult>(
        admin,
        "/api/v1/admin/targets/sync",
        { month, entries },
      );
      expect(denied.status, denied.text).toBe(403);
      expect(denied.body.error?.code).toBe("FORBIDDEN");
      expect(denied.body.error?.message).toContain(
        "Akun demo tidak dapat menjalankan tindakan ini",
      );
    } finally {
      await admin.dispose();
    }
  });
});
