import { randomUUID } from "node:crypto";
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
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

type ApiEnvelope<T> = {
  data?: T;
  error?: { code?: string; message?: string } | null;
};
type ApiResult<T> = { status: number; body: ApiEnvelope<T>; text: string };

type Policy = {
  id: string;
  period: string;
  status: string;
  version: number;
  subThemes: string[];
};

type SubmissionSummary = { id: string; status: string; version: number };
async function call<T = unknown>(
  context: APIRequestContext,
  path: string,
  init?: { method?: "GET" | "POST"; data?: unknown },
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

function jakartaDate(partition: {
  year: number;
  month: number;
  day: number;
}): string {
  return `${partition.year}-${String(partition.month).padStart(2, "0")}-${String(
    partition.day,
  ).padStart(2, "0")}`;
}

function shiftMonth(
  dateOnly: string,
  months: number,
): { year: number; month: number } {
  const [year, month] = dateOnly.split("-").map(Number) as [number, number];
  const base = new Date(Date.UTC(year, month - 1 + months, 1));
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1 };
}

function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function submissionPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    action: "SUBMIT",
    idempotencyKey: `platform-${Date.now()}-${Math.random()}`,
    publishedUrl: `https://e2e.dakosta.example/platform/${Date.now()}-${Math.random()}`,
    platform: "WEBSITE",
    contentType: "INFOGRAFIS",
    mainTheme: "NON_EDUFAST",
    subTheme: "INFORMASI",
    title: `Konten platform ${randomUUID().slice(0, 8)}`,
    narrative:
      "Konten uji kebijakan EDUFAST dan impor akun, sintetis, tanpa data pribadi maupun rekam medis.",
    dateCreated: todayJakarta(),
    location: {
      latitude: -6.9175,
      longitude: 107.6191,
      label: "Titik uji platform Bandung",
      source: "manual_pin",
      accuracyMeters: null,
      consentAt: null,
    },
    privacyAttested: true,
    ...overrides,
  };
}

test.describe("Kebijakan EDUFAST", () => {
  test("demo Master tidak dapat menerbitkan kebijakan periode", async () => {
    const master = await apiContext(ADMIN_STATE);
    try {
      const { year, month } = shiftMonth(todayJakarta(), 3);
      const period = `${year}-${String(month).padStart(2, "0")}`;

      const draft = await call<Policy>(
        master,
        "/api/v1/admin/edufast/policies",
        {
          method: "POST",
          data: {
            period,
            subThemes: ["MOBILE_JKN", "TESTIMONI_PESERTA"],
            explanation: "Uji containment demo pada kebijakan EDUFAST.",
          },
        },
      );
      expect(draft.status, draft.text).toBe(403);
      expect(draft.body.error?.code).toBe("FORBIDDEN");
      expect(draft.body.error?.message).toContain("Akun demo tidak dapat");

      const list = await call<{ policies: Policy[] }>(
        master,
        "/api/v1/admin/edufast/policies",
      );
      expect(list.status, list.text).toBe(200);
      const stored = list.body.data?.policies.find(
        (item) => item.period === period,
      );
      expect(stored).toBeUndefined();
    } finally {
      await master.dispose();
    }
  });

  test("EDUFAST tanpa kebijakan terbit ditolak dengan pesan yang jelas", async () => {
    const client = await apiContext(CLIENT_STATE);
    try {
      const { year, month } = shiftMonth(todayJakarta(), -3);
      const oldDate = jakartaDate({ year, month, day: 10 });

      const result = await call<{ submission: SubmissionSummary }>(
        client,
        "/api/v1/submissions",
        {
          method: "POST",
          data: submissionPayload({
            mainTheme: "EDUFAST",
            subTheme: "MOBILE_JKN",
            dateCreated: oldDate,
            publishedAt: oldDate,
          }),
        },
      );
      expect(result.status).toBe(400);
      expect(result.body.error?.message ?? "").toMatch(/EDUFAST|kebijakan/i);
    } finally {
      await client.dispose();
    }
  });

  test("EDUFAST pada sub-tema yang diizinkan menyimpan versi kebijakan", async () => {
    const client = await apiContext(CLIENT_STATE);
    try {
      const result = await call<{ submission: SubmissionSummary }>(
        client,
        "/api/v1/submissions",
        {
          method: "POST",
          data: submissionPayload({
            mainTheme: "EDUFAST",
            subTheme: "MOBILE_JKN",
          }),
        },
      );
      expect(result.status, result.text).toBe(201);

      const detail = await call<{
        edufastPolicyVersion: number | null;
        mainTheme: string;
      }>(client, `/api/v1/submissions/${result.body.data!.submission.id}`);
      expect(detail.status, detail.text).toBe(200);
      expect(detail.body.data?.mainTheme).toBe("EDUFAST");
      expect(detail.body.data?.edufastPolicyVersion).toBeGreaterThan(0);
    } finally {
      await client.dispose();
    }
  });

  test("EDUFAST pada sub-tema di luar kebijakan ditolak", async () => {
    const client = await apiContext(CLIENT_STATE);
    try {
      const result = await call(client, "/api/v1/submissions", {
        method: "POST",
        data: submissionPayload({ mainTheme: "EDUFAST", subTheme: "KORPORAT" }),
      });
      expect(result.status).toBe(400);
      expect(result.body.error?.message ?? "").toMatch(
        /tidak termasuk|kebijakan/i,
      );
    } finally {
      await client.dispose();
    }
  });
});

test.describe("Impor akun CSV", () => {
  test("template CSV memiliki header dan BOM", async () => {
    const master = await apiContext(ADMIN_STATE);
    try {
      const response = await master.fetch("/api/v1/admin/imports/template");
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/csv");
      expect(response.headers()["x-import-headers"]).toContain(
        "nama,email,peran",
      );

      const buffer = Buffer.from(await response.body());
      expect([buffer[0], buffer[1], buffer[2]]).toEqual([0xef, 0xbb, 0xbf]);
    } finally {
      await master.dispose();
    }
  });

  test("pratinjau impor akun ditolak untuk akun demo", async () => {
    const master = await apiContext(ADMIN_STATE);
    try {
      const csv = [
        "nama,email,peran,wilayah,cabang,organisasi,jabatan",
        "Uji Valid Satu,uji.valid1@e2e.example,stakeholder,,,FKTP-BDG-001,Koordinator Konten",
        "Uji Valid Dua,uji.valid2@e2e.example,admin cabang,,CBG-BDG-KOTA,,Reviewer Cabang",
        "Uji Salah,uji.salah@e2e.example,stakeholder,,,KODE-TIDAK-ADA,Koordinator",
        "Uji Master,uji.master@e2e.example,master,,,,Master",
      ].join("\n");

      const preview = await call(master, "/api/v1/admin/imports/preview", {
        method: "POST",
        data: { filename: "uji-impor.csv", content: csv },
      });
      expect(preview.status, preview.text).toBe(403);
      expect(preview.body.error?.code).toBe("FORBIDDEN");
      expect(preview.body.error?.message).toContain("Akun demo tidak dapat");
    } finally {
      await master.dispose();
    }
  });

  test("komit impor dinonaktifkan untuk akun demo", async () => {
    const master = await apiContext(ADMIN_STATE);
    try {
      const commit = await call(master, "/api/v1/admin/imports/commit", {
        method: "POST",
        data: { importId: "00000000-0000-4000-8000-000000000000" },
      });
      expect(commit.status).toBe(403);
      expect(commit.body.error?.message).toContain("Akun demo tidak dapat");
    } finally {
      await master.dispose();
    }
  });
});

test.describe("Rekonsiliasi analitik dan Red Notice", () => {
  test("capaian wilayah sama dengan jumlah capaian cabangnya", async () => {
    const [regional, branchA1, branchA2] = await Promise.all([
      apiContext(REGIONAL_STATE),
      apiContext(BRANCH_STATE),
      apiContext(BRANCH_A2_STATE),
    ]);
    try {
      const readApproved = async (context: APIRequestContext) => {
        const result = await call<{ approved: { value: number } }>(
          context,
          "/api/v1/analytics/series",
        );
        expect(result.status, result.text).toBe(200);
        return result.body.data!.approved.value;
      };

      const [regionalValue, a1, a2] = await Promise.all([
        readApproved(regional),
        readApproved(branchA1),
        readApproved(branchA2),
      ]);
      expect(regionalValue).toBe(a1 + a2);
    } finally {
      await regional.dispose();
      await branchA1.dispose();
      await branchA2.dispose();
    }
  });

  test("Red Notice menampilkan Faskes tanpa kiriman dan menghormati cakupan", async ({
    browser,
  }) => {
    const master = await browser.newContext({ storageState: ADMIN_STATE });
    try {
      const page = await master.newPage();
      await page.goto("/admin/red-notice");
      await expect(
        page.getByRole("heading", { name: "Red Notice", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Klinik Sehat Bersama")).toBeVisible();
    } finally {
      await master.close();
    }

    const branchA1 = await browser.newContext({ storageState: BRANCH_STATE });
    try {
      const page = await branchA1.newPage();
      await page.goto("/cabang/red-notice");
      await expect(
        page.getByRole("heading", { name: "Red Notice cabang", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Klinik Sehat Bersama")).toHaveCount(0);
    } finally {
      await branchA1.close();
    }

    const branchA2 = await browser.newContext({
      storageState: BRANCH_A2_STATE,
    });
    try {
      const page = await branchA2.newPage();
      await page.goto("/cabang/red-notice");
      await expect(page.getByText("Klinik Sehat Bersama")).toBeVisible();
    } finally {
      await branchA2.close();
    }
  });
});
