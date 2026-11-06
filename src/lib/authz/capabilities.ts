import type { AppRole, Capability } from "./types";

const READ_ONLY: readonly Capability[] = [
  "hierarchy:read",
  "organization:read",
  "account:read",
  "content:read",
  "policy:read",
  "analytics:read",
  "rednotice:read",
  "map:read",
  "export:read",
  "audit:read",
  "notification:read",
  "sla:read",
  "performance:read",
  "performance:export",
];

const MATRIX: Record<AppRole, readonly Capability[]> = {
  MASTER_ADMIN: [
    ...READ_ONLY,
    "hierarchy:manage",
    "organization:manage",
    "account:manage",
    "account:reset",
    "import:manage",
    "content:review",
    "content:override",
    "content:revoke",
    "content:submit",
    "content:create",
    "content:update_own",
    "policy:manage",
    "target:manage",
    "demo:reset",
  ],
  REGIONAL_ADMIN: READ_ONLY,
  BRANCH_ADMIN: [...READ_ONLY, "content:review", "sla:review"],
  STAKEHOLDER: [
    "organization:read",
    "content:create",
    "content:read",
    "content:update_own",
    "content:submit",
    "policy:read",
    "analytics:read",
    "rednotice:read",
    "map:read",
    "export:read",
    "notification:read",
  ],
};

/** Capabilities withheld from demo actors even when their role allows them. */
const DEMO_BLOCKED: readonly Capability[] = [
  "hierarchy:manage",
  "organization:manage",
  "account:manage",
  "account:reset",
  "import:manage",
  "content:override",
  "content:revoke",
  "policy:manage",
  "target:manage",
  "demo:reset",
];

export function capabilitiesForRole(role: AppRole): readonly Capability[] {
  return MATRIX[role];
}

export function capabilitiesForActor(
  role: AppRole,
  isDemo: boolean,
): readonly Capability[] {
  const base = MATRIX[role];
  if (!isDemo) return base;
  return base.filter((capability) => !DEMO_BLOCKED.includes(capability));
}

export function canRole(role: AppRole, capability: Capability): boolean {
  return MATRIX[role].includes(capability);
}
