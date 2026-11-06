import { afterEach, describe, expect, it } from "vitest";

import { guardRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

function request(headers: Record<string, string>): Request {
  return new Request("https://dakosta.example/api/v1/test", { headers });
}

afterEach(() => {
  delete process.env.RATE_LIMIT_AUTH_PER_MINUTE;
});

describe("getClientIp", () => {
  it("memakai x-real-ip yang ditulis Vercel", () => {
    expect(
      getClientIp(
        request({
          "x-real-ip": "203.0.113.10",
          "x-forwarded-for": "10.0.0.1",
        }),
      ),
    ).toBe("203.0.113.10");
  });

  it("memakai hop terakhir x-vercel-forwarded-for", () => {
    expect(
      getClientIp(
        request({ "x-vercel-forwarded-for": "10.0.0.1, 203.0.113.20" }),
      ),
    ).toBe("203.0.113.20");
  });

  it("mengabaikan alamat yang ditempel klien di awal XFF", () => {
    expect(
      getClientIp(
        request({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 203.0.113.30" }),
      ),
    ).toBe("203.0.113.30");
  });

  it("merapikan spasi dan entri kosong", () => {
    expect(
      getClientIp(
        request({ "x-forwarded-for": " 10.0.0.1 , , 203.0.113.40 " }),
      ),
    ).toBe("203.0.113.40");
  });

  it("jatuh ke unknown saat semua header absen", () => {
    expect(getClientIp(request({}))).toBe("unknown");
  });
});

describe("preset rate limit", () => {
  it("memakai batas aman bawaan", () => {
    expect(RATE_LIMIT_PRESETS.auth.limit).toBe(30);
    expect(RATE_LIMIT_PRESETS.mutation.limit).toBe(120);
    expect(RATE_LIMIT_PRESETS.activation.limit).toBe(10);
    expect(RATE_LIMIT_PRESETS.demoLogin.limit).toBe(20);
  });

  it("dapat dimatikan lewat env untuk pengujian", async () => {
    process.env.RATE_LIMIT_AUTH_PER_MINUTE = "0";
    await expect(
      guardRateLimit(request({ "x-real-ip": "203.0.113.50" }), "auth", "auth"),
    ).resolves.toBeUndefined();
  });
});
