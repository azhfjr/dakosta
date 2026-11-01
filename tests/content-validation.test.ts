import { describe, expect, it } from "vitest";

import { detectPii, submissionInputSchema } from "@/lib/validation/content";

const baseSubmit = {
  action: "SUBMIT" as const,
  idempotencyKey: "idem-12345678",
  publishedUrl: "https://contoh.demo/konten",
  platform: "INSTAGRAM" as const,
  contentType: "VIDEO" as const,
  mainTheme: "NON_EDUFAST" as const,
  subTheme: "INFORMASI" as const,
  narrative:
    "Narasi konten demonstrasi sintetis yang cukup panjang untuk validasi.",
  dateCreated: "2026-10-01",
  location: {
    latitude: -6.9,
    longitude: 107.6,
    label: "Puskesmas Demo",
    source: "manual_pin" as const,
  },
  privacyAttested: true,
};

describe("PII guard", () => {
  it("detects NIK-like and JKN-like numbers", () => {
    expect(detectPii("NIK 3273010101010001")).toMatch(/NIK|16 digit/);
    expect(detectPii("kartu 0001234567890")).toMatch(/13 digit/);
    expect(detectPii("NIK: 3273010101010001")).not.toBeNull();
  });

  it("accepts ordinary narrative text", () => {
    expect(detectPii("Konten edukasi tanpa data pribadi.")).toBeNull();
  });

  it("rejects a submission whose narrative embeds identity numbers", () => {
    const parsed = submissionInputSchema.safeParse({
      ...baseSubmit,
      narrative: `${baseSubmit.narrative} NIK 3273010101010001`,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("submission contract", () => {
  it("accepts a complete Non-EDUFAST submission", () => {
    const parsed = submissionInputSchema.safeParse(baseSubmit);
    expect(parsed.success).toBe(true);
  });

  it("requires content type, main theme, and sub-theme on submit", () => {
    const parsed = submissionInputSchema.safeParse({
      ...baseSubmit,
      contentType: undefined,
      mainTheme: undefined,
      subTheme: undefined,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects future content dates", () => {
    const parsed = submissionInputSchema.safeParse({
      ...baseSubmit,
      dateCreated: "2999-01-01",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires a privacy attestation on submit", () => {
    const parsed = submissionInputSchema.safeParse({
      ...baseSubmit,
      privacyAttested: false,
    });
    expect(parsed.success).toBe(false);
  });
});
