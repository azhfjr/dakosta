import { describe, expect, it } from "vitest";

import {
  buildActivationUrl,
  createInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_HOURS,
  invitationExpiry,
} from "@/lib/accounts/activation-link";

describe("tautan aktivasi", () => {
  it("membuat token acak 32 byte dalam format base64url", () => {
    const first = createInvitationToken();
    const second = createInvitationToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("menyimpan hanya hash SHA-256 dari token", () => {
    const token = createInvitationToken();
    const hash = hashInvitationToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashInvitationToken(token)).toBe(hash);
    expect(hashInvitationToken(token.trim())).toBe(hash);
    expect(hashInvitationToken(createInvitationToken())).not.toBe(hash);
  });

  it("menyusun URL aktivasi tanpa garis miring ganda", () => {
    expect(buildActivationUrl("https://dakosta.example/", "abc")).toBe(
      "https://dakosta.example/aktivasi-akun?token=abc",
    );
    expect(buildActivationUrl("https://dakosta.example///", "abc")).toBe(
      "https://dakosta.example/aktivasi-akun?token=abc",
    );
  });

  it("meng-encode token agar aman di query string", () => {
    expect(buildActivationUrl("https://dakosta.example", "a+b/c=")).toBe(
      "https://dakosta.example/aktivasi-akun?token=a%2Bb%2Fc%3D",
    );
  });

  it("memberi masa berlaku 48 jam", () => {
    const now = new Date("2026-11-07T00:00:00.000Z");
    expect(invitationExpiry(now).toISOString()).toBe(
      "2026-11-09T00:00:00.000Z",
    );
    expect(INVITATION_TTL_HOURS).toBe(48);
  });
});
