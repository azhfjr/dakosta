import "server-only";

import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { canRole } from "@/lib/authz/capabilities";
import {
  isOrganizationInScope,
  organizationScopePredicate,
} from "@/lib/authz/predicates";
import type { Capability } from "@/lib/authz/types";
import { errors } from "@/lib/errors";
import type { AppRole, SessionUser } from "@/lib/session";

const PERMISSION_TO_CAPABILITY = {
  "content:create": "content:create",
  "content:read_own": "content:read",
  "content:read_all": "content:read",
  "content:review": "content:review",
  "content:update_own": "content:update_own",
  "stakeholder:read": "organization:read",
  "stakeholder:manage": "organization:manage",
  "kpi:read_all": "analytics:read",
  "kpi:read_own": "analytics:read",
  "user:manage": "account:manage",
  "audit:read": "audit:read",
  "notification:read": "notification:read",
  "export:read": "export:read",
  "demo:reset": "demo:reset",
} as const satisfies Record<string, Capability>;

export type Permission = keyof typeof PERMISSION_TO_CAPABILITY;

export function can(role: AppRole, permission: Permission): boolean {
  return canRole(role, PERMISSION_TO_CAPABILITY[permission]);
}

export function assertCan(
  user: Pick<SessionUser, "role">,
  permission: Permission,
): void {
  if (!can(user.role, permission)) {
    throw errors.forbidden(
      "Peran Anda tidak memiliki izin untuk tindakan ini.",
    );
  }
}

export function canCapability(
  user: Pick<SessionUser, "capabilities">,
  capability: Capability,
): boolean {
  return (user.capabilities as readonly string[]).includes(capability);
}

export function assertCapability(
  user: Pick<SessionUser, "capabilities">,
  capability: Capability,
): void {
  if (!canCapability(user, capability)) {
    throw errors.forbidden(
      "Peran Anda tidak memiliki izin untuk tindakan ini.",
    );
  }
}

export async function getAccessibleStakeholderIds(
  user: SessionUser,
): Promise<string[]> {
  const scopePredicate = organizationScopePredicate(user.scope, {
    id: schema.stakeholders.id,
    branchId: schema.stakeholders.branchOfficeId,
  });

  const rows = await getDb()
    .select({ id: schema.stakeholders.id })
    .from(schema.stakeholders)
    .where(scopePredicate);

  return rows.map((row) => row.id);
}

export async function assertStakeholderAccess(
  user: SessionUser,
  stakeholderId: string,
): Promise<void> {
  if (user.scope.kind === "GLOBAL") return;

  const [row] = await getDb()
    .select({
      id: schema.stakeholders.id,
      branchOfficeId: schema.stakeholders.branchOfficeId,
    })
    .from(schema.stakeholders)
    .where(eq(schema.stakeholders.id, stakeholderId))
    .limit(1);

  if (!row || !isOrganizationInScope(user.scope, row)) {
    throw errors.forbidden(
      "Anda hanya dapat mengakses data organisasi dalam lingkup Anda.",
    );
  }
}
