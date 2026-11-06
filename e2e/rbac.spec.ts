import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_B1_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_B_STATE,
  REGIONAL_STATE,
  baseURL,
  sameOriginHeaders,
} from "./support";

type ApiEnvelope<T> = {
  data?: T;
  error?: { code?: string; message?: string } | null;
};
type ApiResult<T> = { status: number; body: ApiEnvelope<T>; text: string };

type ListItem = { id: string; stakeholderName: string; status: string };

const JAKARTA_ORGANIZATION = "Puskesmas Jakarta Pusat";

async function call<T = unknown>(
  context: APIRequestContext,
  path: string,
  init?: { method?: "GET" | "POST" | "PATCH"; data?: unknown },
): Promise<ApiResult<T>> {
  const response = await context.fetch(path, {
    method: init?.method ?? "GET",
    data: init?.data,
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

function apiContext(state: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL, storageState: state });
}

test.describe("Isolasi API antar peran", () => {
  test("regional bersifat baca-saja dan tidak dapat menulis", async () => {
    const regional = await apiContext(REGIONAL_STATE);
    try {
      const reviewQueue = await call(regional, "/api/v1/admin/reviews");
      expect(reviewQueue.status).toBe(403);

      const reviewWrite = await call(regional, "/api/v1/admin/reviews", {
        method: "POST",
        data: {},
      });
      expect(reviewWrite.status).toBe(403);

      const regionWrite = await call(regional, "/api/v1/admin/regions", {
        method: "POST",
        data: {},
      });
      expect(regionWrite.status).toBe(403);

      const organizationWrite = await call(
        regional,
        "/api/v1/admin/organizations",
        {
          method: "POST",
          data: {},
        },
      );
      expect(organizationWrite.status).toBe(403);

      const policyWrite = await call(
        regional,
        "/api/v1/admin/edufast/policies",
        {
          method: "GET",
        },
      );
      expect(policyWrite.status).toBe(403);

      const submissionWrite = await call(regional, "/api/v1/submissions", {
        method: "POST",
        data: {},
      });
      expect(submissionWrite.status).toBe(403);
    } finally {
      await regional.dispose();
    }
  });

  test("regional hanya membaca organisasi pada wilayahnya", async () => {
    const [regionalA, regionalB] = await Promise.all([
      apiContext(REGIONAL_STATE),
      apiContext(REGIONAL_B_STATE),
    ]);
    try {
      const listA = await call<ListItem[]>(
        regionalA,
        "/api/v1/submissions?limit=100",
      );
      expect(listA.status, listA.text).toBe(200);
      expect((listA.body.data ?? []).length).toBeGreaterThan(0);
      expect(
        (listA.body.data ?? []).some(
          (item) => item.stakeholderName === JAKARTA_ORGANIZATION,
        ),
      ).toBe(false);

      const listB = await call<ListItem[]>(
        regionalB,
        "/api/v1/submissions?limit=100",
      );
      expect(listB.status, listB.text).toBe(200);
      expect(
        (listB.body.data ?? []).some(
          (item) => item.stakeholderName === JAKARTA_ORGANIZATION,
        ),
      ).toBe(true);
    } finally {
      await regionalA.dispose();
      await regionalB.dispose();
    }
  });

  test("antrean cabang hanya memuat organisasi cabang tersebut", async () => {
    const [branchA1, branchB1] = await Promise.all([
      apiContext(BRANCH_STATE),
      apiContext(BRANCH_B1_STATE),
    ]);
    try {
      const queueA1 = await call<{ items: Array<{ stakeholderName: string }> }>(
        branchA1,
        "/api/v1/admin/reviews?status=ALL&pageSize=50",
      );
      expect(queueA1.status, queueA1.text).toBe(200);
      expect(
        (queueA1.body.data?.items ?? []).some(
          (item) => item.stakeholderName === JAKARTA_ORGANIZATION,
        ),
      ).toBe(false);

      const queueB1 = await call<{ items: Array<{ stakeholderName: string }> }>(
        branchB1,
        "/api/v1/admin/reviews?status=ALL&pageSize=50",
      );
      expect(queueB1.status, queueB1.text).toBe(200);
      expect(
        (queueB1.body.data?.items ?? []).some(
          (item) => item.stakeholderName === JAKARTA_ORGANIZATION,
        ),
      ).toBe(true);
    } finally {
      await branchA1.dispose();
      await branchB1.dispose();
    }
  });

  test("master dan cabang memakai antrean berbeda; stakeholder ditolak", async () => {
    const [master, client] = await Promise.all([
      apiContext(ADMIN_STATE),
      apiContext(CLIENT_STATE),
    ]);
    try {
      const masterQueue = await call(
        master,
        "/api/v1/admin/reviews?status=ALL",
      );
      expect(masterQueue.status).toBe(200);

      const clientQueue = await call(
        client,
        "/api/v1/admin/reviews?status=ALL",
      );
      expect(clientQueue.status).toBe(403);

      const clientAccounts = await call(client, "/api/v1/admin/users");
      expect(clientAccounts.status).toBe(403);
    } finally {
      await master.dispose();
      await client.dispose();
    }
  });
});

test.describe("Guard rute UI per peran", () => {
  test("regional dialihkan dari area master dan cabang", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: REGIONAL_STATE });
    try {
      const page = await context.newPage();
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/akses-ditolak$/, { timeout: 20_000 });
      await page.goto("/cabang");
      await expect(page).toHaveURL(/\/akses-ditolak$/, { timeout: 20_000 });

      await page.goto("/wilayah");
      await expect(
        page.getByRole("heading", { name: "SLA Check wilayah" }),
      ).toBeVisible();
      await expect(page.getByText(/Regional Jawa Barat/).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("reviewer cabang dialihkan dari area master dan wilayah", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: BRANCH_STATE });
    try {
      const page = await context.newPage();
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/akses-ditolak$/, { timeout: 20_000 });
      await page.goto("/wilayah");
      await expect(page).toHaveURL(/\/akses-ditolak$/, { timeout: 20_000 });

      await page.goto("/cabang");
      await expect(
        page.getByRole("heading", { name: "SLA Check cabang" }),
      ).toBeVisible();
      await expect(page.getByText(/Cabang Bandung Kota/).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe("Step-up Master dan pencabutan", () => {
  test("demo Master ditolak sebelum step-up pada pencabutan", async () => {
    const master = await apiContext(ADMIN_STATE);
    try {
      const createAccount = await call(master, "/api/v1/admin/users", {
        method: "POST",
        data: {},
      });
      expect(createAccount.status).toBe(403);
      expect(createAccount.body.error?.message).toContain(
        "Akun demo tidak dapat mengubah akun",
      );

      const approved = await call<Array<{ id: string }>>(
        master,
        "/api/v1/submissions?status=APPROVED&limit=1",
      );
      expect(approved.status, approved.text).toBe(200);
      const sample = approved.body.data?.[0];
      expect(sample).toBeTruthy();

      const revoke = await call(
        master,
        `/api/v1/admin/contents/${sample!.id}/revoke`,
        {
          method: "POST",
          data: { reason: "Uji keamanan: konfirmasi kata sandi wajib." },
        },
      );
      expect(revoke.status).toBe(403);
      // Containment demo berjalan sebelum pemeriksaan step-up.
      expect(revoke.body.error?.code).toBe("FORBIDDEN");
      expect(revoke.body.error?.message).toContain("Akun demo tidak dapat");

      const stillApproved = await call<{ status: string }>(
        master,
        `/api/v1/submissions/${sample!.id}`,
      );
      expect(stillApproved.body.data?.status).toBe("APPROVED");
    } finally {
      await master.dispose();
    }
  });
});
