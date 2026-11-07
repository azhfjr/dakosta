import { describe, expect, it } from "vitest";

import {
  createInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_HOURS,
  invitationExpiry,
} from "@/lib/accounts/activation-link";
import { APP_ROLES, homePathForRole } from "@/lib/authz/types";

describe("landing setelah login", () => {
  it("mengarahkan setiap peran ke Dashboard, bukan ke antrean SLA", () => {
    expect(homePathForRole("MASTER_ADMIN")).toBe("/admin");
    expect(homePathForRole("REGIONAL_ADMIN")).toBe("/wilayah/dashboard");
    expect(homePathForRole("BRANCH_ADMIN")).toBe("/cabang/dashboard");
    expect(homePathForRole("STAKEHOLDER")).toBe("/client");
  });

  it("mencakup seluruh peran yang dikenal", () => {
    for (const role of APP_ROLES) {
      expect(homePathForRole(role)).toMatch(/^\//);
    }
  });
});

describe("tautan aktivasi sekali pakai", () => {
  it("memberi hash berbeda untuk setiap token", () => {
    const tokens = new Set(
      Array.from({ length: 20 }, () =>
        hashInvitationToken(createInvitationToken()),
      ),
    );
    expect(tokens.size).toBe(20);
  });

  it("kedaluwarsa dalam 48 jam dan tidak pernah menyimpan token mentah", () => {
    const now = new Date("2026-11-07T07:00:00.000Z");
    const expiry = invitationExpiry(now);
    expect(expiry.getTime() - now.getTime()).toBe(
      INVITATION_TTL_HOURS * 60 * 60 * 1000,
    );
    const token = createInvitationToken();
    const hash = hashInvitationToken(token);
    expect(hash).not.toContain(token);
    expect(hash).toHaveLength(64);
  });
});
