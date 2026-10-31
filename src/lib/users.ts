import "server-only";

import { asc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CLIENT" | null;
  active: boolean;
  mustChangePassword: boolean;
  isDemo: boolean;
  displayTitle: string | null;
  createdAt: string;
  stakeholders: Array<{ id: string; name: string }>;
};

export type StakeholderOption = {
  id: string;
  name: string;
  serviceArea: string;
};

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      createdAt: schema.user.createdAt,
      active: schema.userProfiles.active,
      mustChangePassword: schema.userProfiles.mustChangePassword,
      isDemo: schema.userProfiles.isDemo,
      displayTitle: schema.userProfiles.displayTitle,
    })
    .from(schema.user)
    .innerJoin(
      schema.userProfiles,
      eq(schema.userProfiles.userId, schema.user.id),
    )
    .orderBy(asc(schema.user.createdAt));

  const roleRows = await db
    .select({
      userId: schema.userRoleMemberships.userId,
      role: schema.userRoleMemberships.role,
    })
    .from(schema.userRoleMemberships);

  const membershipRows = await db
    .select({
      userId: schema.userStakeholderMemberships.userId,
      stakeholderId: schema.stakeholders.id,
      name: schema.stakeholders.name,
    })
    .from(schema.userStakeholderMemberships)
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.userStakeholderMemberships.stakeholderId),
    )
    .orderBy(asc(schema.stakeholders.name));

  return rows.map((row) => {
    const roles = roleRows
      .filter((entry) => entry.userId === row.id)
      .map((entry) => entry.role);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: roles.includes("ADMIN")
        ? "ADMIN"
        : roles.includes("CLIENT")
          ? "CLIENT"
          : null,
      active: row.active,
      mustChangePassword: row.mustChangePassword,
      isDemo: row.isDemo,
      displayTitle: row.displayTitle,
      createdAt: row.createdAt.toISOString(),
      stakeholders: membershipRows
        .filter((entry) => entry.userId === row.id)
        .map((entry) => ({ id: entry.stakeholderId, name: entry.name })),
    };
  });
}

export async function listStakeholderOptions(): Promise<StakeholderOption[]> {
  const rows = await getDb()
    .select({
      id: schema.stakeholders.id,
      name: schema.stakeholders.name,
      serviceArea: schema.stakeholders.serviceArea,
    })
    .from(schema.stakeholders)
    .where(eq(schema.stakeholders.status, "ACTIVE"))
    .orderBy(asc(schema.stakeholders.name));

  return rows;
}
