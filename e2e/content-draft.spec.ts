import { randomUUID } from "node:crypto";
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { CLIENT_STATE, baseURL, sameOriginHeaders } from "./support";

type Envelope<T> = {
  data?: T;
  error?: { code?: string; message?: string } | null;
};

function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function call<T>(
  context: APIRequestContext,
  path: string,
  init?: { method?: "GET" | "POST"; data?: unknown },
): Promise<{ status: number; body: Envelope<T>; text: string }> {
  const response = await context.fetch(path, {
    method: init?.method ?? "GET",
    data: init?.data,
    headers: sameOriginHeaders,
  });
  const text = await response.text();
  let body: Envelope<T> = {};
  try {
    body = JSON.parse(text) as Envelope<T>;
  } catch {
    body = {};
  }
  return { status: response.status(), body, text };
}

async function fillDraftMinimum(page: Page, url: string): Promise<void> {
  await page.locator("#lapor-url").fill(url);
  await page.locator("#lapor-platform").click();
  await page.getByRole("option", { name: "Instagram", exact: true }).click();
}

test.describe("Draf pelaporan tanpa pemilih organisasi", () => {
  test.use({ storageState: CLIENT_STATE });

  test("menyimpan draf, memulihkannya, dan mengabaikan organisasi dari klien", async ({
    page,
  }) => {
    const url = `https://e2e.dakosta.example/draf/${randomUUID()}`;
    const title = `Draf E2E ${randomUUID().slice(0, 8)}`;

    await page.goto("/client/lapor");
    await expect(
      page.getByRole("heading", { name: "Formulir pelaporan konten" }),
    ).toBeVisible();

    // Organisasi berasal dari profil akun; tidak ada pemilih manual.
    await expect(
      page
        .locator("#konten")
        .getByText("Klinik Sehat Nusantara", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("#lapor-stakeholder")).toHaveCount(0);

    await fillDraftMinimum(page, url);
    await page.locator("#lapor-title").fill(title);
    await page.getByRole("button", { name: "Simpan draf" }).click();
    await expect(
      page.getByText("Draf tersimpan. Anda dapat melanjutkan nanti.", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 });

    // Muat ulang: draf lokal dipulihkan tanpa meminta organisasi lagi.
    await page.reload();
    await expect(page.locator("#lapor-url")).toHaveValue(url);
    await expect(page.locator("#lapor-stakeholder")).toHaveCount(0);

    const context = await playwrightRequest.newContext({
      baseURL,
      storageState: CLIENT_STATE,
    });
    try {
      const me = await call<{ stakeholderIds: string[] }>(
        context,
        "/api/v1/me",
      );
      expect(me.status, me.text).toBe(200);
      const organizationId = me.body.data?.stakeholderIds[0];
      expect(organizationId).toBeTruthy();

      const drafts = await call<Array<{ id: string; title: string | null }>>(
        context,
        `/api/v1/submissions?status=DRAFT&limit=50`,
      );
      expect(drafts.status, drafts.text).toBe(200);
      const saved = (drafts.body.data ?? []).find(
        (item) => item.title === title,
      );
      expect(saved, "draf tersimpan di server").toBeTruthy();

      const detail = await call<{
        referenceCode: string;
        stakeholder: { id: string };
      }>(context, `/api/v1/submissions/${saved!.id}`);
      expect(detail.status, detail.text).toBe(200);
      expect(detail.body.data?.stakeholder.id).toBe(organizationId);
      const referenceCode = detail.body.data!.referenceCode;

      // Tautan layanan: draf dibuka kembali dari server, bukan dari pemilih organisasi.
      await page.goto(`/client/lapor?submissionId=${saved!.id}`);
      await expect(
        page.getByRole("heading", { name: "Perbaiki konten" }),
      ).toBeVisible();
      await expect(
        page.getByText(`Memperbaiki konten ${referenceCode}`, { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Tautan & tema/ }).click();
      await expect(page.locator("#lapor-url")).toHaveValue(url);
      await expect(page.locator("#lapor-stakeholder")).toHaveCount(0);

      // Klien yang mengirim stakeholderId lain tetap diikat ke organisasi profilnya.
      const tampered = await call<{ submission: { id: string } }>(
        context,
        "/api/v1/submissions",
        {
          method: "POST",
          data: {
            action: "DRAFT",
            idempotencyKey: randomUUID(),
            stakeholderId: randomUUID(),
            publishedUrl: `https://e2e.dakosta.example/asing/${randomUUID()}`,
            platform: "INSTAGRAM",
            dateCreated: jakartaToday(),
          },
        },
      );
      expect([200, 201], tampered.text).toContain(tampered.status);
      const tamperedId = tampered.body.data?.submission.id;
      expect(tamperedId).toBeTruthy();

      const tamperedDetail = await call<{ stakeholder: { id: string } }>(
        context,
        `/api/v1/submissions/${tamperedId}`,
      );
      expect(tamperedDetail.status, tamperedDetail.text).toBe(200);
      expect(tamperedDetail.body.data?.stakeholder.id).toBe(organizationId);
    } finally {
      await context.dispose();
    }
  });
});
