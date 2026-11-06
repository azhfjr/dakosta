import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/authz/same-origin";

function request(headers: Record<string, string>): Request {
  return new Request("https://dakosta.example/api/v1/test", {
    method: "POST",
    headers,
  });
}

function expectForbidden(fn: () => void): AppError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect(appError.status).toBe(403);
    expect(appError.code).toBe("FORBIDDEN");
    return appError;
  }
  throw new Error("assertSameOrigin tidak melempar galat");
}

describe("assertSameOrigin", () => {
  it("menerima Origin yang cocok dengan x-forwarded-host", () => {
    expect(() =>
      assertSameOrigin(
        request({
          origin: "https://dakosta.example",
          "x-forwarded-host": "dakosta.example",
        }),
      ),
    ).not.toThrow();
  });

  it("menerima Referer saat Origin tidak dikirim", () => {
    expect(() =>
      assertSameOrigin(
        request({
          referer: "https://dakosta.example/admin/konten?page=2",
          "x-forwarded-host": "dakosta.example",
        }),
      ),
    ).not.toThrow();
  });

  it("memprioritaskan Origin saat keduanya tersedia", () => {
    const error = expectForbidden(() =>
      assertSameOrigin(
        request({
          origin: "https://evil.example",
          referer: "https://dakosta.example/admin",
          "x-forwarded-host": "dakosta.example",
        }),
      ),
    );
    expect(error.message).toContain("lintas asal");
  });

  it("menolak permintaan tanpa Origin dan Referer", () => {
    const error = expectForbidden(() =>
      assertSameOrigin(request({ "x-forwarded-host": "dakosta.example" })),
    );
    expect(error.message).toContain("tanpa asal");
  });

  it("menolak permintaan tanpa host tujuan", () => {
    const error = expectForbidden(() =>
      assertSameOrigin(request({ origin: "https://dakosta.example" })),
    );
    expect(error.message).toContain("lintas asal");
  });

  it("menolak Origin lintas asal", () => {
    expectForbidden(() =>
      assertSameOrigin(
        request({
          origin: "https://evil.example",
          "x-forwarded-host": "dakosta.example",
        }),
      ),
    );
  });

  it("menolak Origin yang tidak dapat diurai", () => {
    const error = expectForbidden(() =>
      assertSameOrigin(
        request({ origin: "bukan-url", "x-forwarded-host": "dakosta.example" }),
      ),
    );
    expect(error.message).toContain("tidak valid");
  });

  it("jatuh ke header host saat x-forwarded-host tidak ada", () => {
    expect(() =>
      assertSameOrigin(
        request({ origin: "https://dakosta.example", host: "dakosta.example" }),
      ),
    ).not.toThrow();
  });
});
