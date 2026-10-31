import { describe, expect, it } from "vitest";

import { canRole, capabilitiesForRole } from "@/lib/authz/capabilities";
import type { AppRole } from "@/lib/authz/types";

const ROLES: AppRole[] = [
  "MASTER_ADMIN",
  "REGIONAL_ADMIN",
  "BRANCH_ADMIN",
  "STAKEHOLDER",
];

describe("role capability matrix", () => {
  it("gives every role at least one capability", () => {
    for (const role of ROLES) {
      expect(capabilitiesForRole(role).length).toBeGreaterThan(0);
    }
  });

  it("keeps regional admins strictly read-only", () => {
    expect(canRole("REGIONAL_ADMIN", "content:read")).toBe(true);
    expect(canRole("REGIONAL_ADMIN", "analytics:read")).toBe(true);
    expect(canRole("REGIONAL_ADMIN", "content:review")).toBe(false);
    expect(canRole("REGIONAL_ADMIN", "content:override")).toBe(false);
    expect(canRole("REGIONAL_ADMIN", "content:revoke")).toBe(false);
    expect(canRole("REGIONAL_ADMIN", "organization:manage")).toBe(false);
    expect(canRole("REGIONAL_ADMIN", "account:manage")).toBe(false);
    expect(canRole("REGIONAL_ADMIN", "policy:manage")).toBe(false);
    expect(canRole("REGIONAL_ADMIN", "import:manage")).toBe(false);
  });

  it("lets branch admins review but not override or revoke", () => {
    expect(canRole("BRANCH_ADMIN", "content:review")).toBe(true);
    expect(canRole("BRANCH_ADMIN", "content:override")).toBe(false);
    expect(canRole("BRANCH_ADMIN", "content:revoke")).toBe(false);
    expect(canRole("BRANCH_ADMIN", "content:create")).toBe(false);
    expect(canRole("BRANCH_ADMIN", "hierarchy:manage")).toBe(false);
  });

  it("keeps stakeholders inside their own organization", () => {
    expect(canRole("STAKEHOLDER", "content:create")).toBe(true);
    expect(canRole("STAKEHOLDER", "content:update_own")).toBe(true);
    expect(canRole("STAKEHOLDER", "content:read")).toBe(true);
    expect(canRole("STAKEHOLDER", "content:review")).toBe(false);
    expect(canRole("STAKEHOLDER", "export:read")).toBe(true);
    expect(canRole("STAKEHOLDER", "account:manage")).toBe(false);
  });

  it("grants master the full administrative surface", () => {
    for (const capability of [
      "hierarchy:manage",
      "organization:manage",
      "account:manage",
      "account:reset",
      "import:manage",
      "content:review",
      "content:override",
      "content:revoke",
      "policy:manage",
      "target:manage",
      "audit:read",
    ] as const) {
      expect(canRole("MASTER_ADMIN", capability)).toBe(true);
    }
  });
});
