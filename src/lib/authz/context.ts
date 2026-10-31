import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";

import { getDb, schema } from "@/db";
import { getAuth } from "@/lib/auth";

import { capabilitiesForRole } from "./capabilities";
import {
  homePathForRole,
  isAppRole,
  type AppRole,
  type AuthContext,
  type Scope,
} from "./types";

async function loadScope(
  row: typeof schema.userMemberships.$inferSelect,
  role: AppRole,
): Promise<{ scope: Scope; scopeLabel: string } | null> {
  const db = getDb();

  if (role === "MASTER_ADMIN") {
    return { scope: { kind: "GLOBAL" }, scopeLabel: "Seluruh organisasi" };
  }

  if (role === "REGIONAL_ADMIN") {
    if (!row.regionalOfficeId) return null;
    const [region] = await db
      .select({ id: schema.regionalOffices.id, name: schema.regionalOffices.name })
      .from(schema.regionalOffices)
      .where(eq(schema.regionalOffices.id, row.regionalOfficeId))
      .limit(1);
    if (!region) return null;
    const branches = await db
      .select({ id: schema.branchOffices.id })
      .from(schema.branchOffices)
      .where(eq(schema.branchOffices.regionalOfficeId, region.id));
    return {
      scope: {
        kind: "REGION",
        regionId: region.id,
        regionName: region.name,
        branchIds: branches.map((branch) => branch.id),
      },
      scopeLabel: region.name,
    };
  }

  if (role === "BRANCH_ADMIN") {
    if (!row.branchOfficeId) return null;
    const [branch] = await db
      .select({
        id: schema.branchOffices.id,
        name: schema.branchOffices.name,
        regionId: schema.regionalOffices.id,
        regionName: schema.regionalOffices.name,
      })
      .from(schema.branchOffices)
      .innerJoin(
        schema.regionalOffices,
        eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
      )
      .where(eq(schema.branchOffices.id, row.branchOfficeId))
      .limit(1);
    if (!branch) return null;
    return {
      scope: {
        kind: "BRANCH",
        branchId: branch.id,
        branchName: branch.name,
        regionId: branch.regionId,
        regionName: branch.regionName,
      },
      scopeLabel: branch.name,
    };
  }

  if (!row.organizationId) return null;
  const [organization] = await db
    .select({
      id: schema.stakeholders.id,
      name: schema.stakeholders.name,
      branchId: schema.stakeholders.branchOfficeId,
      branchName: schema.branchOffices.name,
      regionId: schema.regionalOffices.id,
      regionName: schema.regionalOffices.name,
    })
    .from(schema.stakeholders)
    .leftJoin(
      schema.branchOffices,
      eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
    )
    .leftJoin(
      schema.regionalOffices,
      eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
    )
    .where(eq(schema.stakeholders.id, row.organizationId))
    .limit(1);
  if (!organization) return null;

  return {
    scope: {
      kind: "ORG",
      organizationId: organization.id,
      organizationName: organization.name,
      branchId: organization.branchId ?? null,
      branchName: organization.branchName ?? null,
      regionId: organization.regionId ?? null,
      regionName: organization.regionName ?? null,
    },
    scopeLabel: organization.name,
  };
}

async function loadAuthContext(): Promise<AuthContext | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const db = getDb();
  const [row] = await db
    .select({
      membership: schema.userMemberships,
      profile: schema.userProfiles,
    })
    .from(schema.userMemberships)
    .innerJoin(
      schema.userProfiles,
      eq(schema.userProfiles.userId, schema.userMemberships.userId),
    )
    .where(
      and(
        eq(schema.userMemberships.userId, session.user.id),
        isNull(schema.userMemberships.revokedAt),
      ),
    )
    .limit(1);

  if (!row) return null;
  if (!row.profile.active || row.profile.status !== "ACTIVE") return null;

  const role = row.membership.role;
  if (!isAppRole(role)) return null;

  const resolved = await loadScope(row.membership, role);
  if (!resolved) return null;

  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role,
    scope: resolved.scope,
    scopeLabel: resolved.scopeLabel,
    capabilities: capabilitiesForRole(role),
    mustChangePassword: row.profile.mustChangePassword,
    displayTitle: row.profile.displayTitle,
    membershipId: row.membership.id,
    homePath: homePathForRole(role),
  };
}

export const getAuthContext = cache(loadAuthContext);

export function hasCapability(ctx: AuthContext, capability: string): boolean {
  return (ctx.capabilities as readonly string[]).includes(capability);
}
