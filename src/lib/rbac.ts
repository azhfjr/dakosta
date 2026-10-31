import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { errors } from "@/lib/errors";
import type { AppRole, SessionUser } from "@/lib/session";

const PERMISSIONS = {
  "content:create": ["CLIENT"],
  "content:read_own": ["CLIENT"],
  "content:read_all": ["ADMIN"],
  "content:review": ["ADMIN"],
  "content:update_own": ["CLIENT"],
  "stakeholder:read": ["ADMIN", "CLIENT"],
  "stakeholder:manage": ["ADMIN"],
  "kpi:read_all": ["ADMIN"],
  "kpi:read_own": ["CLIENT"],
  "user:manage": ["ADMIN"],
  "audit:read": ["ADMIN"],
  "notification:read": ["ADMIN", "CLIENT"],
  "export:read": ["ADMIN", "CLIENT"],
  "demo:reset": ["ADMIN"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: AppRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly AppRole[]).includes(role);
}

export function assertCan(user: Pick<SessionUser, "role">, permission: Permission): void {
  if (!can(user.role, permission)) {
    throw errors.forbidden(
      "Peran Anda tidak memiliki izin untuk tindakan ini.",
    );
  }
}

export async function getAccessibleStakeholderIds(user: SessionUser): Promise<string[]> {
  if (user.role === "ADMIN") {
    const rows = await getDb()
      .select({ id: schema.stakeholders.id })
      .from(schema.stakeholders)
      .where(eq(schema.stakeholders.status, "ACTIVE"));
    return rows.map((row) => row.id);
  }

  if (user.stakeholderIds.length === 0) return [];

  const rows = await getDb()
    .select({ id: schema.userStakeholderMemberships.stakeholderId })
    .from(schema.userStakeholderMemberships)
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.userStakeholderMemberships.stakeholderId),
    )
    .where(
      and(
        eq(schema.userStakeholderMemberships.userId, user.id),
        eq(schema.stakeholders.status, "ACTIVE"),
      ),
    );
  return rows.map((row) => row.id);
}

export async function assertStakeholderAccess(
  user: SessionUser,
  stakeholderId: string,
): Promise<void> {
  if (user.role === "ADMIN") return;

  if (user.stakeholderIds.length === 0) {
    throw errors.forbidden("Akun Anda belum terhubung ke stakeholder mana pun.");
  }

  const [membership] = await getDb()
    .select({ id: schema.userStakeholderMemberships.id })
    .from(schema.userStakeholderMemberships)
    .where(
      and(
        eq(schema.userStakeholderMemberships.userId, user.id),
        eq(schema.userStakeholderMemberships.stakeholderId, stakeholderId),
        inArray(schema.userStakeholderMemberships.stakeholderId, user.stakeholderIds),
      ),
    )
    .limit(1);

  if (!membership) {
    throw errors.forbidden("Anda hanya dapat mengakses data stakeholder Anda sendiri.");
  }
}
