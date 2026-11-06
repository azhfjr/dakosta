import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { AppError, errors } from "@/lib/errors";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

type Envelope = {
  data: unknown;
  meta: { requestId: string; [key: string]: unknown };
  error: null | { code: string; message: string; details?: unknown };
};

async function envelope(response: Response): Promise<Envelope> {
  return (await response.json()) as Envelope;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("jsonOk", () => {
  it("membungkus data dengan meta requestId", async () => {
    const response = jsonOk({ id: "abc" }, { requestId: REQUEST_ID });
    expect(response.status).toBe(200);
    const body = await envelope(response);
    expect(body).toEqual({
      data: { id: "abc" },
      meta: { requestId: REQUEST_ID },
      error: null,
    });
  });

  it("menggabungkan meta tambahan", async () => {
    const response = jsonOk([], {
      requestId: REQUEST_ID,
      meta: { count: 0 },
      status: 201,
    });
    expect(response.status).toBe(201);
    const body = await envelope(response);
    expect(body.meta).toEqual({ requestId: REQUEST_ID, count: 0 });
  });
});

describe("jsonError", () => {
  it("memetakan AppError apa adanya", async () => {
    const response = jsonError(errors.payloadTooLarge(), REQUEST_ID);
    expect(response.status).toBe(413);
    const body = await envelope(response);
    expect(body.error).toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      message: "Isi permintaan melebihi batas 1 MB.",
    });
  });

  it("menyertakan details AppError", async () => {
    const response = jsonError(
      new AppError("RATE_LIMITED", "Terlalu banyak permintaan.", 429, {
        retryAfterSeconds: 60,
      }),
      REQUEST_ID,
    );
    expect(response.status).toBe(429);
    const body = await envelope(response);
    expect(body.error?.details).toEqual({ retryAfterSeconds: 60 });
  });

  it("memetakan ZodError menjadi VALIDATION_ERROR 400", async () => {
    const result = z.object({ email: z.string().email() }).safeParse({
      email: "bukan-email",
    });
    expect(result.success).toBe(false);
    const response = jsonError(
      result.success ? new Error("tidak diharapkan") : result.error,
      REQUEST_ID,
    );
    expect(response.status).toBe(400);
    const body = await envelope(response);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    const details = body.error?.details as Array<{ path: string }>;
    expect(details).toEqual([{ path: "email", message: expect.any(String) }]);
  });

  it("memetakan status auth-like 401, 403, dan 429", async () => {
    const cases = [
      { status: 401, code: "UNAUTHORIZED" },
      { status: 403, code: "FORBIDDEN" },
      { status: 429, code: "RATE_LIMITED" },
    ];
    for (const item of cases) {
      const response = jsonError(
        { status: item.status, message: "ditolak" },
        REQUEST_ID,
      );
      expect(response.status).toBe(item.status);
      const body = await envelope(response);
      expect(body.error?.code).toBe(item.code);
      expect(body.error?.message).toBe("ditolak");
    }
  });

  it("tidak membocorkan status NaN sebagai 4xx", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = jsonError(
      { status: Number.NaN, message: "aneh" },
      REQUEST_ID,
    );
    expect(response.status).toBe(500);
    const body = await envelope(response);
    expect(body.error?.code).toBe("INTERNAL_ERROR");
    expect(spy).toHaveBeenCalled();
  });

  it("menyamarkan galat tak dikenal sebagai 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = jsonError(new Error("rahasia internal"), REQUEST_ID);
    expect(response.status).toBe(500);
    const body = await envelope(response);
    expect(body.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan pada server.",
    });
    expect(JSON.stringify(body)).not.toContain("rahasia internal");
  });
});
