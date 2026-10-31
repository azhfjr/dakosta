import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { headers } from "next/headers";
import { cache } from "react";

import { getDb, schema } from "@/db";
import { getAuth } from "@/lib/auth";

import { capabilitiesForActor } from "./capabilities";
import {
  homePathForRole,
  isAppRole,
  type AppRole,
  type AuthContext,
  type Scope,
} from "./types";

/**
 * Data scope diambil dalam satu kueri bersama membership agar autentikasi tidak
 * menambah round-trip serial ke basis data.
 */
const scopeRegion = alias(schema.regionalOffices, "scope_region");
const scopeBranch = alias(schema.branchOffices, "scope_branch");
const scopeBranchRegion = alias(schema.regionalOffices, "scope_branch_region");
const scopeOrg = alias(schema.stakeholders, "scope_org");
const scopeOrgBranch = alias(schema.branchOffices, "scope_org_branch");
const scopeOrgRegion = alias(schema.regionalOffices, "scope_org_region");

type ScopeData = {
  regionId: string | null;
  regionName: string | null;
  branchId: string | null;
  branchName: string | null;
  branchRegionId: string | null;
  branchRegionName: string | null;
  orgId: string | null;
  orgName: string | null;
  orgBranchId: string | null;
  orgBranchName: string | null;
  orgRegionId: string | null;
  orgRegionName: string | null;
};

async function loadScope(
  data: ScopeData,
  role: AppRole,
): Promise<{ scope: Scope; scopeLabel: string } | null> {
  if (role === "MASTER_ADMIN") {
    return { scope: { kind: "GLOBAL" }, scopeLabel: "Seluruh organisasi" };
  }

  if (role === "REGIONAL_ADMIN") {
    if (!data.regionId || !data.regionName) return null;
    const db = getDb();
    const branches = await db
      .select({ id: schema.branchOffices.id })
      .from(schema.branchOffices)
      .where(eq(schema.branchOffices.regionalOfficeId, data.regionId));
    return {
      scope: {
        kind: "REGION",
        regionId: data.regionId,
        regionName: data.regionName,
        branchIds: branches.map((branch) => branch.id),
      },
      scopeLabel: data.regionName,
    };
  }

  if (role === "BRANCH_ADMIN") {
    if (!data.branchId || !data.branchName) return null;
    if (!data.branchRegionId || !data.branchRegionName) return null;
    return {
      scope: {
        kind: "BRANCH",
        branchId: data.branchId,
        branchName: data.branchName,
        regionId: data.branchRegionId,
        regionName: data.branchRegionName,
      },
      scopeLabel: data.branchName,
    };
  }

  if (!data.orgId || !data.orgName) return null;
  return {
    scope: {
      kind: "ORG",
      organizationId: data.orgId,
      organizationName: data.orgName,
      branchId: data.orgBranchId ?? null,
      branchName: data.orgBranchName ?? null,
      regionId: data.orgRegionId ?? null,
      regionName: data.orgRegionName ?? null,
    },
    scopeLabel: data.orgName,
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
      scope: {
        regionId: scopeRegion.id,
        regionName: scopeRegion.name,
        branchId: scopeBranch.id,
        branchName: scopeBranch.name,
        branchRegionId: scopeBranchRegion.id,
        branchRegionName: scopeBranchRegion.name,
        orgId: scopeOrg.id,
        orgName: scopeOrg.name,
        orgBranchId: scopeOrgBranch.id,
        orgBranchName: scopeOrgBranch.name,
        orgRegionId: scopeOrgRegion.id,
        orgRegionName: scopeOrgRegion.name,
      },
    })
    .from(schema.userMemberships)
    .innerJoin(
      schema.userProfiles,
      eq(schema.userProfiles.userId, schema.userMemberships.userId),
    )
    .leftJoin(
      scopeRegion,
      eq(scopeRegion.id, schema.userMemberships.regionalOfficeId),
    )
    .leftJoin(
      scopeBranch,
      eq(scopeBranch.id, schema.userMemberships.branchOfficeId),
    )
    .leftJoin(
      scopeBranchRegion,
      eq(scopeBranchRegion.id, scopeBranch.regionalOfficeId),
    )
    .leftJoin(scopeOrg, eq(scopeOrg.id, schema.userMemberships.organizationId))
    .leftJoin(scopeOrgBranch, eq(scopeOrgBranch.id, scopeOrg.branchOfficeId))
    .leftJoin(
      scopeOrgRegion,
      eq(scopeOrgRegion.id, scopeOrgBranch.regionalOfficeId),
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

  const resolved = await loadScope(row.scope, role);
  if (!resolved) return null;

  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role,
    scope: resolved.scope,
    scopeLabel: resolved.scopeLabel,
    capabilities: capabilitiesForActor(role, row.profile.isDemo),
    isDemo: row.profile.isDemo,
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
