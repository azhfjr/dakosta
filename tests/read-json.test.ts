import { describe, expect, it } from "vitest";

import { MAX_JSON_BODY_BYTES, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://dakosta.example/api/v1/test", {
    method: "POST",
    body,
    headers,
  });
}

async function expectAppError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return error as AppError;
  }
  throw new Error("readJson tidak melempar galat");
}

describe("readJson", () => {
  it("mengurai JSON yang valid", async () => {
    await expect(readJson(post('{"ok":true}'))).resolves.toEqual({ ok: true });
  });

  it("menolak Content-Length di atas batas 1 MB", async () => {
    const error = await expectAppError(
      readJson(
        post("{}", { "content-length": String(MAX_JSON_BODY_BYTES + 1) }),
      ),
    );
    expect(error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(error.status).toBe(413);
  });

  it("menghitung byte UTF-8, bukan jumlah karakter", async () => {
    const body = `"${"é".repeat(600_000)}"`;
    expect(body.length).toBeLessThan(MAX_JSON_BODY_BYTES);
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(
      MAX_JSON_BODY_BYTES,
    );
    const error = await expectAppError(readJson(post(body)));
    expect(error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(error.status).toBe(413);
  });

  it("menerima isi di bawah batas", async () => {
    const value = "x".repeat(1_000);
    await expect(readJson(post(JSON.stringify({ value })))).resolves.toEqual({
      value,
    });
  });

  it("menolak JSON yang rusak dengan 400", async () => {
    const error = await expectAppError(readJson(post("{bukan-json")));
    expect(error.code).toBe("INVALID_JSON");
    expect(error.status).toBe(400);
  });
});
