import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getDb, schema } from "@/db";
import { getAuth } from "@/lib/auth";
import { AppError, errors } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

export type AppRole = "ADMIN" | "CLIENT";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  roles: AppRole[];
  mustChangePassword: boolean;
  active: boolean;
  displayTitle: string | null;
  stakeholderIds: string[];
};

function isAppRole(value: string): value is AppRole {
  return value === "ADMIN" || value === "CLIENT";
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const db = getDb();
  const userId = session.user.id;

  const [profile] = await db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId))
    .limit(1);

  if (!profile || !profile.active) return null;

  const roleRows = await db
    .select({ role: schema.userRoleMemberships.role })
    .from(schema.userRoleMemberships)
    .where(eq(schema.userRoleMemberships.userId, userId));

  const roles = roleRows.map((row) => row.role).filter(isAppRole);
  if (roles.length === 0) return null;

  const membershipRows =
    roles.includes("CLIENT") && !roles.includes("ADMIN")
      ? await db
          .select({ stakeholderId: schema.userStakeholderMemberships.stakeholderId })
          .from(schema.userStakeholderMemberships)
          .where(and(eq(schema.userStakeholderMemberships.userId, userId)))
      : [];

  return {
    id: userId,
    name: session.user.name,
    email: session.user.email,
    role: roles.includes("ADMIN") ? "ADMIN" : "CLIENT",
    roles,
    mustChangePassword: profile.mustChangePassword,
    active: profile.active,
    displayTitle: profile.displayTitle,
    stakeholderIds: membershipRows.map((row) => row.stakeholderId),
  };
}

export async function requireUser(options: { allowPasswordChangePending?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  if (user.mustChangePassword && !options.allowPasswordChangePending) {
    redirect("/ganti-password");
  }
  return user;
}

export async function requireRole(role: AppRole): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) {
    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "ACCESS_DENIED",
      recordType: "ROUTE",
      recordId: role === "ADMIN" ? "/admin" : "/client",
      after: { reason: "role_mismatch", attemptedRole: role },
    });
    redirect("/akses-ditolak");
  }
  return user;
}

export async function getApiUser(options: { allowPasswordChangePending?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw errors.unauthorized();
  if (user.mustChangePassword && !options.allowPasswordChangePending) {
    throw new AppError(
      "PASSWORD_CHANGE_REQUIRED",
      "Ubah kata sandi terlebih dahulu sebelum melanjutkan.",
      403,
    );
  }
  return user;
}

export async function getApiUserWithRole(role: AppRole): Promise<SessionUser> {
  const user = await getApiUser();
  if (user.role !== role) {
    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "ACCESS_DENIED",
      recordType: "API",
      recordId: role,
      after: { reason: "role_mismatch" },
    });
    throw errors.forbidden();
  }
  return user;
}
