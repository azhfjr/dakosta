import { randomUUID } from "node:crypto";
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { ADMIN_STATE, CLIENT_STATE, baseURL } from "./support";

type ApiError = { code?: string; message?: string; details?: unknown } | null;
type ApiEnvelope<T> = { data?: T; error?: ApiError; meta?: Record<string, unknown> };
type ApiResult<T> = { status: number; body: ApiEnvelope<T>; text: string };

type SubmissionSummary = {
  id: string;
  referenceCode: string;
  status: string;
  version: number;
};

type SubmissionScope = { stakeholderId: string; themeId: string };

type NotificationLite = {
  id: string;
  eventType: string;
  objectId: string | null;
  href: string | null;
};

type ReviewDecisionResult = {
  submissionId?: string;
  status?: string;
  version?: number;
};

const CHECKLIST_KEYS = [
  "relevansiTema",
  "akurasiKonten",
  "kelengkapanTautan",
  "etikaDanPrivasi",
] as const;

const NARRATIVE =
  "Konten uji end-to-end sintetis untuk memastikan alur pelaporan, validasi, dan capaian hanya memakai data DEMO tanpa data pribadi.";

const numberId = new Intl.NumberFormat("id-ID");

function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function call<T = unknown>(
  context: APIRequestContext,
  path: string,
  init?: { method?: "GET" | "POST" | "PATCH"; data?: unknown },
): Promise<ApiResult<T>> {
  const response = await context.fetch(path, {
    method: init?.method ?? "GET",
    data: init?.data,
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

function apiContext(role: "admin" | "client"): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL,
    storageState: role === "admin" ? ADMIN_STATE : CLIENT_STATE,
  });
}

async function clientScope(context: APIRequestContext): Promise<SubmissionScope> {
  const me = await call<{ stakeholderIds: string[] }>(context, "/api/v1/me");
  expect(me.status).toBe(200);
  const stakeholderId = me.body.data?.stakeholderIds?.[0];
  expect(stakeholderId, "akun klien demo harus terkait stakeholder").toBeTruthy();

  const approved = await call<Array<{ id: string }>>(
    context,
    "/api/v1/submissions?status=APPROVED&limit=100",
  );
  expect(approved.status).toBe(200);
  const sample = approved.body.data?.[0];
  expect(sample, "butuh minimal satu konten disetujui untuk contoh tema").toBeTruthy();

  const detail = await call<{ theme: { id: string } }>(
    context,
    `/api/v1/submissions/${sample!.id}`,
  );
  expect(detail.status).toBe(200);
  const themeId = detail.body.data?.theme.id;
  expect(themeId).toBeTruthy();

  return { stakeholderId: stakeholderId!, themeId: themeId! };
}

function submissionPayload(
  scope: SubmissionScope,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const today = jakartaToday();
  return {
    action: "SUBMIT",
    idempotencyKey: randomUUID(),
    stakeholderId: scope.stakeholderId,
    publishedUrl: `https://e2e.dakosta.example/konten/${randomUUID()}`,
    platform: "WEBSITE",
    themeId: scope.themeId,
    title: `Konten uji E2E ${Date.now()}`,
    narrative: NARRATIVE,
    dateCreated: today,
    publishedAt: today,
    location: {
      latitude: -6.9175,
      longitude: 107.6191,
      label: "Titik uji E2E Bandung",
      source: "manual_pin",
      accuracyMeters: null,
      consentAt: null,
    },
    privacyAttested: true,
    ...overrides,
  };
}

async function createSubmitted(
  context: APIRequestContext,
  scope: SubmissionScope,
  overrides: Record<string, unknown> = {},
): Promise<SubmissionSummary> {
  const result = await call<{ submission: SubmissionSummary }>(
    context,
    "/api/v1/submissions",
    { method: "POST", data: submissionPayload(scope, overrides) },
  );
  expect(result.status, result.text).toBe(201);
  const submission = result.body.data?.submission;
  expect(submission?.status).toBe("SUBMITTED");
  return submission!;
}

async function decide(
  context: APIRequestContext,
  submissionId: string,
  expectedVersion: number,
  action: "APPROVE" | "REQUEST_REVISION" | "REJECT",
  notes?: string,
): Promise<ApiResult<ReviewDecisionResult>> {
  return call<ReviewDecisionResult>(context, "/api/v1/admin/reviews", {
    method: "POST",
    data: {
      submissionId,
      expectedVersion,
      action,
      checklist: {
        relevansiTema: true,
        akurasiKonten: true,
        kelengkapanTautan: true,
        etikaDanPrivasi: true,
      },
      notes,
      conflictOfInterest: false,
    },
  });
}

async function approvedValue(context: APIRequestContext): Promise<number> {
  const result = await call<{ approved: { value: number } }>(
    context,
    "/api/v1/dashboard/admin",
  );
  expect(result.status, result.text).toBe(200);
  const value = result.body.data?.approved.value;
  expect(typeof value).toBe("number");
  return value as number;
}

async function submissionDetail(
  context: APIRequestContext,
  id: string,
): Promise<{ id: string; status: string; version: number }> {
  const result = await call<{ id: string; status: string; version: number }>(
    context,
    `/api/v1/submissions/${id}`,
  );
  expect(result.status, result.text).toBe(200);
  return result.body.data!;
}

async function fillWizardStepsOneAndTwo(page: Page, url: string): Promise<void> {
  await page.goto("/client/lapor");
  await expect(
    page.getByRole("heading", { name: "Formulir pelaporan konten" }),
  ).toBeVisible();

  await page.locator("#lapor-stakeholder").click();
  await page.getByRole("option", { name: /Klinik Sehat Nusantara/ }).click();
  await page.locator("#lapor-url").fill(url);
  await page.locator("#lapor-theme").click();
  await page.getByRole("option", { name: "Edukasi JKN" }).click();
  await page.locator("#lapor-title").fill(`Konten E2E ${Date.now()}`);
  await page.getByRole("button", { name: "Lanjut" }).click();

  await page.locator("#lapor-narrative").fill(NARRATIVE);
  await page.getByRole("button", { name: "Lanjut" }).click();
}

async function submitViaWizard(page: Page): Promise<string> {
  await fillWizardStepsOneAndTwo(
    page,
    `https://e2e.dakosta.example/konten/${randomUUID()}`,
  );

  await page.getByText("Input koordinat manual").click();
  await page.locator("#lokasi-lintang").fill("-6.91750");
  await page.locator("#lokasi-bujur").fill("107.61910");
  await page.getByRole("button", { name: "Terapkan" }).click();
  await expect(page.locator("#lapor-location-label")).toHaveValue(
    /Klinik Sehat Nusantara/,
  );
  await page.getByRole("button", { name: "Lanjut" }).click();

  await page.locator("#lapor-privacy").click();
  await expect(page.locator("#lapor-privacy")).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Kirim untuk validasi" }).click();

  await expect(page.getByRole("heading", { name: "Konten terkirim" })).toBeVisible({
    timeout: 20_000,
  });
  const reference = (await page.locator("span.font-mono").first().innerText()).trim();
  expect(reference).toMatch(/^DKS-\d{6}-[A-Z2-9]{5}$/);
  return reference;
}

async function approveViaUi(page: Page, submissionId: string): Promise<void> {
  await page.goto(`/admin/validasi/${submissionId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  for (const key of CHECKLIST_KEYS) {
    const checkbox = page.locator(`#checklist-${key}`);
    await checkbox.click();
    await expect(checkbox).toHaveAttribute("aria-checked", "true");
  }

  await page.getByRole("button", { name: "Setujui konten" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Ya, setujui" }).click();
  await expect(page).toHaveURL(/\/admin\/validasi$/, { timeout: 20_000 });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

let admin: APIRequestContext;
let client: APIRequestContext;

test.beforeEach(async () => {
  admin = await apiContext("admin");
  client = await apiContext("client");
});

test.afterEach(async () => {
  await Promise.all([admin.dispose(), client.dispose()]);
});

test.describe("Dasbor admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test("menampilkan capaian disetujui dari API", async ({ page }) => {
    const value = await approvedValue(admin);
    await page.goto("/admin");
    const hero = page.getByRole("region", { name: "Capaian utama" });
    await expect(hero).toBeVisible();
    await expect(hero).toContainText(numberId.format(value));
    await expect(hero).toContainText("konten disetujui");
  });
});

test.describe("Wizard pelaporan klien", () => {
  test.use({ storageState: CLIENT_STATE });

  test("menolak lanjut tanpa titik lokasi", async ({ page }) => {
    await fillWizardStepsOneAndTwo(
      page,
      `https://e2e.dakosta.example/konten/${randomUUID()}`,
    );
    await page.getByRole("button", { name: "Lanjut" }).click();
    await expect(page.locator("#lapor-location-error")).toContainText(
      "Tandai lokasi konten",
    );
    await expect(page.locator("#lapor-location-label")).toBeVisible();
  });

  test("alur emas: lapor, setujui lewat UI, KPI +1 dan notifikasi", async ({
    page,
    browser,
  }) => {
    const baseline = await approvedValue(admin);

    const reference = await submitViaWizard(page);

    const queue = await call<{ items: Array<{ id: string; referenceCode: string }> }>(
      admin,
      `/api/v1/admin/reviews?search=${encodeURIComponent(reference)}&status=ALL`,
    );
    expect(queue.status, queue.text).toBe(200);
    const item = queue.body.data?.items.find(
      (entry) => entry.referenceCode === reference,
    );
    expect(item, `konten ${reference} harus masuk antrean validasi`).toBeTruthy();

    const adminContext = await browser.newContext({ storageState: ADMIN_STATE });
    try {
      const adminPage = await adminContext.newPage();
      await approveViaUi(adminPage, item!.id);
    } finally {
      await adminContext.close();
    }

    await expect
      .poll(() => approvedValue(admin), { timeout: 20_000 })
      .toBe(baseline + 1);

    const detail = await submissionDetail(client, item!.id);
    expect(detail.status).toBe("APPROVED");

    const inbox = await call<{ items: NotificationLite[] }>(
      client,
      "/api/v1/notifications?limit=50",
    );
    expect(inbox.status, inbox.text).toBe(200);
    expect(
      inbox.body.data?.items.some(
        (entry) => entry.eventType === "CONTENT_APPROVED" && entry.objectId === item!.id,
      ),
    ).toBe(true);
  });

  test("tombol ekspor mengikuti filter status", async ({ page }) => {
    await page.goto("/client/konten?status=APPROVED");
    await expect(page.getByRole("heading", { name: "Konten saya" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ekspor CSV" })).toHaveAttribute(
      "href",
      "/api/v1/exports/submissions?status=APPROVED",
    );
  });
});

test.describe("Notifikasi realtime", () => {
  test("pengiriman baru tampil di kotak masuk admin via SSE", async ({ browser }) => {
    const scope = await clientScope(client);
    const adminContext = await browser.newContext({ storageState: ADMIN_STATE });
    try {
      const adminPage = await adminContext.newPage();
      await adminPage.goto("/admin/notifikasi");
      await expect(adminPage.getByRole("heading", { name: "Notifikasi" })).toBeVisible();

      const created = await createSubmitted(client, scope);

      // Polling fallback berjalan setiap 20 detik; batas 12 detik membuktikan SSE.
      // Toast live juga memuat referensi yang sama, jadi batasi ke daftar notifikasi.
      await expect(
        adminPage
          .getByRole("region", { name: "Daftar notifikasi" })
          .getByText(created.referenceCode, { exact: false }),
      ).toBeVisible({ timeout: 12_000 });
    } finally {
      await adminContext.close();
    }
  });
});

test.describe("Siklus keputusan", () => {
  test("revisi, kirim ulang, lalu setujui menambah capaian tepat satu", async () => {
    const scope = await clientScope(client);
    const created = await createSubmitted(client, scope);

    const revision = await decide(
      admin,
      created.id,
      created.version,
      "REQUEST_REVISION",
      "Lengkapi tautan sumber dan perjelas konteks publikasinya.",
    );
    expect(revision.status, revision.text).toBe(200);
    expect((await submissionDetail(client, created.id)).status).toBe(
      "REVISION_REQUIRED",
    );

    const resubmitted = await call<{ submission: SubmissionSummary }>(
      client,
      "/api/v1/submissions",
      {
        method: "POST",
        data: submissionPayload(scope, {
          submissionId: created.id,
          action: "SUBMIT",
        }),
      },
    );
    expect(resubmitted.status, resubmitted.text).toBe(200);
    expect(resubmitted.body.data?.submission.version).toBe(2);
    expect(resubmitted.body.data?.submission.status).toBe("SUBMITTED");

    const baseline = await approvedValue(admin);
    const approval = await decide(admin, created.id, 2, "APPROVE");
    expect(approval.status, approval.text).toBe(200);
    await expect
      .poll(() => approvedValue(admin), { timeout: 20_000 })
      .toBe(baseline + 1);
    expect((await submissionDetail(client, created.id)).status).toBe("APPROVED");
  });

  test("konten ditolak tidak menambah capaian", async () => {
    const scope = await clientScope(client);
    const created = await createSubmitted(client, scope);
    const baseline = await approvedValue(admin);

    const rejection = await decide(
      admin,
      created.id,
      created.version,
      "REJECT",
      "Konten di luar cakupan tema dan tidak dapat diverifikasi.",
    );
    expect(rejection.status, rejection.text).toBe(200);
    expect((await submissionDetail(client, created.id)).status).toBe("REJECTED");
    expect(await approvedValue(admin)).toBe(baseline);
  });

  test("dua persetujuan bersamaan menghasilkan satu konflik", async () => {
    const scope = await clientScope(client);
    const created = await createSubmitted(client, scope);

    const [first, second] = await Promise.all([
      decide(admin, created.id, created.version, "APPROVE"),
      decide(admin, created.id, created.version, "APPROVE"),
    ]);

    const statuses = [first.status, second.status].sort((left, right) => left - right);
    expect(statuses).toEqual([200, 409]);
    expect((await submissionDetail(client, created.id)).status).toBe("APPROVED");

    const conflict = first.status === 409 ? first : second;
    expect(conflict.body.error?.code).toBeTruthy();
  });
});

test.describe("Batas dan idempotensi", () => {
  test("klien tidak dapat membaca data stakeholder lain", async () => {
    const foreignSubmission = "20000000-0000-4000-8000-000000000002";
    const foreignStakeholder = "10000000-0000-4000-8000-000000000002";

    const detail = await call(client, `/api/v1/submissions/${foreignSubmission}`);
    expect(detail.status).toBe(403);

    const exportResponse = await client.fetch(
      `/api/v1/exports/submissions?stakeholderId=${foreignStakeholder}`,
    );
    expect(exportResponse.status()).toBe(403);

    const adminApi = await call(client, "/api/v1/dashboard/admin");
    expect(adminApi.status).toBe(403);
  });

  test("peran klien dialihkan dari area admin", async ({ browser }) => {
    const clientContext = await browser.newContext({ storageState: CLIENT_STATE });
    try {
      const page = await clientContext.newPage();
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/akses-ditolak$/, { timeout: 20_000 });
    } finally {
      await clientContext.close();
    }
  });

  test("kunci idempotensi mengembalikan rekaman yang sama", async () => {
    const scope = await clientScope(client);
    const key = randomUUID();
    const payload = submissionPayload(scope, { idempotencyKey: key });

    const first = await call<{ submission: SubmissionSummary }>(
      client,
      "/api/v1/submissions",
      { method: "POST", data: payload },
    );
    expect(first.status, first.text).toBe(201);

    const second = await call<{ submission: SubmissionSummary }>(
      client,
      "/api/v1/submissions",
      { method: "POST", data: payload },
    );
    expect(second.status, second.text).toBe(200);
    expect(second.body.data?.submission.id).toBe(first.body.data?.submission.id);
  });

  test("ekspor CSV konsisten dengan daftar berstatus disetujui", async () => {
    const list = await call<Array<{ referenceCode: string; status: string }>>(
      client,
      "/api/v1/submissions?status=APPROVED&limit=100",
    );
    expect(list.status, list.text).toBe(200);
    const approvedReferences = new Set(
      (list.body.data ?? []).map((item) => item.referenceCode),
    );

    const response = await client.fetch("/api/v1/exports/submissions?status=APPROVED");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");

    const buffer = Buffer.from(await response.body());
    expect([buffer[0], buffer[1], buffer[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const text = buffer.toString("utf8").replace(/^\uFEFF/, "").trim();
    const lines = text.split(/\r?\n/);
    const rows = lines.slice(1).map(parseCsvLine);

    expect(rows.length).toBe(approvedReferences.size);
    for (const row of rows) {
      expect(row[5]).toBe("Disetujui");
      expect(approvedReferences.has(row[0]!)).toBe(true);
    }
  });
});
