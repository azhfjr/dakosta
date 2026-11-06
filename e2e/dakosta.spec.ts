import { randomUUID } from "node:crypto";
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import {
  ADMIN_STATE,
  BRANCH_A2_STATE,
  BRANCH_STATE,
  CLIENT_STATE,
  REGIONAL_STATE,
  baseURL,
  sameOriginHeaders,
} from "./support";

type ApiError = { code?: string; message?: string; details?: unknown } | null;
type ApiEnvelope<T> = {
  data?: T;
  error?: ApiError;
  meta?: Record<string, unknown>;
};
type ApiResult<T> = { status: number; body: ApiEnvelope<T>; text: string };

type SubmissionSummary = {
  id: string;
  referenceCode: string;
  status: string;
  version: number;
};

type Me = {
  role: string;
  scopeLabel: string;
  stakeholderIds: string[];
};

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

function apiContext(role: keyof typeof roleStates): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL,
    storageState: roleStates[role],
  });
}

const roleStates = {
  admin: ADMIN_STATE,
  regional: REGIONAL_STATE,
  branch: BRANCH_STATE,
  branchA2: BRANCH_A2_STATE,
  client: CLIENT_STATE,
} as const;

async function me(context: APIRequestContext): Promise<Me> {
  const result = await call<Me>(context, "/api/v1/me");
  expect(result.status, result.text).toBe(200);
  return result.body.data!;
}

function submissionPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const today = jakartaToday();
  return {
    action: "SUBMIT",
    idempotencyKey: randomUUID(),
    publishedUrl: `https://e2e.dakosta.example/konten/${randomUUID()}`,
    platform: "WEBSITE",
    contentType: "INFOGRAFIS",
    mainTheme: "NON_EDUFAST",
    subTheme: "INFORMASI",
    title: `Konten uji E2E ${randomUUID().slice(0, 8)}`,
    narrative: NARRATIVE,
    dateCreated: today,
    publishedAt: today,
    privacyAttested: true,
    ...overrides,
  };
}

async function createSubmitted(
  context: APIRequestContext,
  overrides: Record<string, unknown> = {},
): Promise<SubmissionSummary> {
  const result = await call<{ submission: SubmissionSummary }>(
    context,
    "/api/v1/submissions",
    { method: "POST", data: submissionPayload(overrides) },
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
): Promise<{
  id: string;
  status: string;
  version: number;
  stakeholder: { id: string };
}> {
  const result = await call<{
    id: string;
    status: string;
    version: number;
    stakeholder: { id: string };
  }>(context, `/api/v1/submissions/${id}`);
  expect(result.status, result.text).toBe(200);
  return result.body.data!;
}

async function selectOption(
  page: Page,
  trigger: string,
  option: string,
): Promise<void> {
  await page.locator(trigger).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function fillWizardStepOne(page: Page, url: string): Promise<void> {
  await page.goto("/client/lapor");
  await expect(
    page.getByRole("heading", { name: "Formulir pelaporan konten" }),
  ).toBeVisible();

  // Organisasi mengikuti akun; tidak ada pemilih organisasi manual.
  await expect(
    page
      .locator("#konten")
      .getByText("Klinik Sehat Nusantara", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#lapor-stakeholder")).toHaveCount(0);

  await page.locator("#lapor-url").fill(url);
  await selectOption(page, "#lapor-content-type", "Video");
  await selectOption(page, "#lapor-main-theme", "Non-EDUFAST");
  await selectOption(page, "#lapor-sub-theme", "Informasi");
  await page
    .locator("#lapor-title")
    .fill(`Konten E2E ${randomUUID().slice(0, 8)}`);
  await page.getByRole("button", { name: "Lanjut" }).click();

  await page.locator("#lapor-narrative").fill(NARRATIVE);
  await page.getByRole("button", { name: "Lanjut" }).click();
}

async function submitViaWizard(page: Page): Promise<string> {
  await fillWizardStepOne(
    page,
    `https://e2e.dakosta.example/konten/${randomUUID()}`,
  );

  await expect(
    page.getByText("Mengikuti lokasi Klinik Sehat Nusantara"),
  ).toBeVisible();
  await page.locator("#lapor-privacy").click();
  await expect(page.locator("#lapor-privacy")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: "Kirim untuk validasi" }).click();

  await expect(
    page.getByRole("heading", { name: "Konten terkirim" }),
  ).toBeVisible({
    timeout: 20_000,
  });
  const reference = (
    await page.locator("span.font-mono").first().innerText()
  ).trim();
  expect(reference).toMatch(/^DKS-\d{6}-[A-Z2-9]{5}$/);
  return reference;
}

async function approveViaBranchUi(
  page: Page,
  submissionId: string,
): Promise<void> {
  await page.goto(`/cabang/review/${submissionId}`);
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
  await expect(page).toHaveURL(/\/cabang(\?.*)?$/, { timeout: 20_000 });
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
let branch: APIRequestContext;
let branchA2: APIRequestContext;
let client: APIRequestContext;

test.beforeEach(async () => {
  [admin, branch, branchA2, client] = await Promise.all([
    apiContext("admin"),
    apiContext("branch"),
    apiContext("branchA2"),
    apiContext("client"),
  ]);
});

test.afterEach(async () => {
  await Promise.all([
    admin.dispose(),
    branch.dispose(),
    branchA2.dispose(),
    client.dispose(),
  ]);
});

test.describe("Dasbor Master", () => {
  test.use({ storageState: ADMIN_STATE });

  test("menampilkan capaian disetujui dari API", async ({ page }) => {
    const value = await approvedValue(admin);
    await page.goto("/admin");
    const hero = page.getByRole("region", { name: "Capaian utama" });
    await expect(hero).toBeVisible();
    await expect(hero).toContainText(numberId.format(value));
    await expect(hero).toContainText("konten disetujui");
  });

  test("halaman hierarki menampilkan wilayah dan cabang", async ({ page }) => {
    await page.goto("/admin/wilayah");
    await expect(
      page.getByRole("heading", { name: /wilayah|regional/i }).first(),
    ).toBeVisible();
    await expect(page.getByText("Regional Jawa Barat")).toBeVisible();

    await page.goto("/admin/cabang");
    await expect(page.getByText("Cabang Bandung Kota")).toBeVisible();
  });

  test("akun regional dan cabang tercatat pada direktori akun", async ({
    page,
  }) => {
    await page.goto("/admin/akun");
    await expect(
      page.getByText("wilayah.a@demo.dakosta.local", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("cabang.a1@demo.dakosta.local", { exact: true }),
    ).toBeVisible();
  });
});

test.describe("Wizard pelaporan stakeholder", () => {
  test.use({ storageState: CLIENT_STATE });

  test("lokasi konten mengikuti instansi tanpa input titik per konten", async ({
    page,
  }) => {
    await fillWizardStepOne(
      page,
      `https://e2e.dakosta.example/konten/${randomUUID()}`,
    );
    await expect(
      page.getByText("Mengikuti lokasi Klinik Sehat Nusantara"),
    ).toBeVisible();
    await expect(page.locator("#lapor-location-label")).toHaveCount(0);
    await expect(page.locator("#lokasi-lintang")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Kirim untuk validasi" }),
    ).toBeVisible();
  });

  test("alur emas: lapor, setujui reviewer cabang lewat UI, KPI +1 dan notifikasi", async ({
    page,
    browser,
  }) => {
    const baseline = await approvedValue(admin);
    const reference = await submitViaWizard(page);

    const queue = await call<{
      items: Array<{ id: string; referenceCode: string }>;
    }>(
      branch,
      `/api/v1/admin/reviews?search=${encodeURIComponent(reference)}&status=ALL`,
    );
    expect(queue.status, queue.text).toBe(200);
    const item = queue.body.data?.items.find(
      (entry) => entry.referenceCode === reference,
    );
    expect(item, `konten ${reference} harus masuk antrean cabang`).toBeTruthy();

    const branchContext = await browser.newContext({
      storageState: BRANCH_STATE,
    });
    try {
      const branchPage = await branchContext.newPage();
      await approveViaBranchUi(branchPage, item!.id);
    } finally {
      await branchContext.close();
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
        (entry) =>
          entry.eventType === "CONTENT_APPROVED" && entry.objectId === item!.id,
      ),
    ).toBe(true);
  });

  test("tombol ekspor mengikuti filter status", async ({ page }) => {
    await page.goto("/client/konten?status=APPROVED");
    await expect(
      page.getByRole("heading", { name: "Konten saya" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ekspor CSV" }),
    ).toHaveAttribute("href", "/api/v1/exports/submissions?status=APPROVED");
  });
});

test.describe("Notifikasi realtime cabang", () => {
  test("pengiriman baru tampil di kotak masuk cabang via SSE", async ({
    browser,
  }) => {
    const branchContext = await browser.newContext({
      storageState: BRANCH_STATE,
    });
    try {
      const branchPage = await branchContext.newPage();
      await branchPage.goto("/cabang/notifikasi");
      await expect(
        branchPage.getByRole("heading", { name: "Notifikasi" }),
      ).toBeVisible();

      const created = await createSubmitted(client);

      await expect(
        branchPage
          .getByRole("region", { name: "Daftar notifikasi" })
          .getByText(created.referenceCode, { exact: false }),
      ).toBeVisible({ timeout: 12_000 });
    } finally {
      await branchContext.close();
    }
  });
});

test.describe("Siklus keputusan reviewer cabang", () => {
  test("revisi, kirim ulang, lalu setujui menambah capaian tepat satu", async () => {
    const created = await createSubmitted(client);

    const revision = await decide(
      branch,
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
        data: submissionPayload({ submissionId: created.id, action: "SUBMIT" }),
      },
    );
    expect(resubmitted.status, resubmitted.text).toBe(200);
    expect(resubmitted.body.data?.submission.version).toBe(2);
    expect(resubmitted.body.data?.submission.status).toBe("RESUBMITTED");

    const baseline = await approvedValue(admin);
    const approval = await decide(branch, created.id, 2, "APPROVE");
    expect(approval.status, approval.text).toBe(200);
    await expect
      .poll(() => approvedValue(admin), { timeout: 20_000 })
      .toBe(baseline + 1);
    expect((await submissionDetail(client, created.id)).status).toBe(
      "APPROVED",
    );
  });

  test("konten ditolak tidak menambah capaian", async () => {
    const created = await createSubmitted(client);
    const baseline = await approvedValue(admin);

    const rejection = await decide(
      branch,
      created.id,
      created.version,
      "REJECT",
      "Konten di luar cakupan tema dan tidak dapat diverifikasi.",
    );
    expect(rejection.status, rejection.text).toBe(200);
    expect((await submissionDetail(client, created.id)).status).toBe(
      "REJECTED",
    );
    expect(await approvedValue(admin)).toBe(baseline);
  });

  test("dua persetujuan bersamaan menghasilkan satu konflik", async () => {
    const created = await createSubmitted(client);

    const [first, second] = await Promise.all([
      decide(branch, created.id, created.version, "APPROVE"),
      decide(branch, created.id, created.version, "APPROVE"),
    ]);

    const statuses = [first.status, second.status].sort(
      (left, right) => left - right,
    );
    expect(statuses).toEqual([200, 409]);
    expect((await submissionDetail(client, created.id)).status).toBe(
      "APPROVED",
    );

    const conflict = first.status === 409 ? first : second;
    expect(conflict.body.error?.code).toBeTruthy();
  });

  test("cabang lain tidak dapat memutuskan konten cabang ini", async () => {
    const created = await createSubmitted(client);
    const foreign = await decide(
      branchA2,
      created.id,
      created.version,
      "APPROVE",
    );
    expect([403, 404]).toContain(foreign.status);
    expect((await submissionDetail(client, created.id)).status).toBe(
      "SUBMITTED",
    );
  });
});

test.describe("Batas dan idempotensi", () => {
  test("stakeholder tidak dapat memalsukan organisasi lewat payload", async () => {
    const foreignOrganization = "10000000-0000-4000-8000-000000000002";
    const meDetail = await me(client);
    const ownOrganization = meDetail.stakeholderIds[0];
    expect(ownOrganization).toBeTruthy();

    const created = await createSubmitted(client, {
      stakeholderId: foreignOrganization,
    });
    const detail = await submissionDetail(client, created.id);
    expect(detail.stakeholder.id).toBe(ownOrganization);
    expect(detail.stakeholder.id).not.toBe(foreignOrganization);
  });

  test("stakeholder tidak dapat membaca data organisasi lain", async () => {
    const foreignSubmission = "20000000-0000-4000-8000-000000000002";
    const foreignStakeholder = "10000000-0000-4000-8000-000000000002";

    const detail = await call(
      client,
      `/api/v1/submissions/${foreignSubmission}`,
    );
    expect([403, 404]).toContain(detail.status);

    const exportResponse = await client.fetch(
      `/api/v1/exports/submissions?stakeholderId=${foreignStakeholder}`,
    );
    expect([403, 404]).toContain(exportResponse.status());

    const adminApi = await call(client, "/api/v1/dashboard/admin");
    expect(adminApi.status).toBe(403);
  });

  test("peran stakeholder dialihkan dari area admin dan cabang", async ({
    browser,
  }) => {
    const clientContext = await browser.newContext({
      storageState: CLIENT_STATE,
    });
    try {
      const page = await clientContext.newPage();
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/akses-ditolak$/, { timeout: 20_000 });
      await page.goto("/cabang");
      await expect(page).toHaveURL(/\/akses-ditolak$/, { timeout: 20_000 });
    } finally {
      await clientContext.close();
    }
  });

  test("kunci idempotensi mengembalikan rekaman yang sama", async () => {
    const key = randomUUID();
    const payload = submissionPayload({ idempotencyKey: key });

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
    expect(second.body.data?.submission.id).toBe(
      first.body.data?.submission.id,
    );
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

    const response = await client.fetch(
      "/api/v1/exports/submissions?status=APPROVED",
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");

    const buffer = Buffer.from(await response.body());
    expect([buffer[0], buffer[1], buffer[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const text = buffer
      .toString("utf8")
      .replace(/^\uFEFF/, "")
      .trim();
    const lines = text.split(/\r?\n/);
    const rows = lines.slice(1).map(parseCsvLine);

    expect(rows.length).toBe(approvedReferences.size);
    for (const row of rows) {
      expect(approvedReferences.has(row[0]!)).toBe(true);
    }
  });
});

test("sesi demo mencakup empat peran dengan cakupan berbeda", async () => {
  const [master, regionalA] = await Promise.all([
    me(admin),
    apiContext("regional").then(async (context) => {
      try {
        return await me(context);
      } finally {
        await context.dispose();
      }
    }),
  ]);
  expect(master.role).toBe("MASTER_ADMIN");
  expect(regionalA.role).toBe("REGIONAL_ADMIN");
  expect(regionalA.scopeLabel).not.toBe(master.scopeLabel);
});
