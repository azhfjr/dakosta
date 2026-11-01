import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { headers } from "next/headers";
import { cache } from "react";

import { getDb, schema } from "@/db";
import { getAuth } from "@/lib/auth";

import { capabilitiesForActor } from "./capabilities";
import {
  homePathForRole,
  isAppRole,
  isLocationStatus,
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
  regionBranchIds: unknown;
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

function stringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string");
}

async function loadScope(
  data: ScopeData,
  role: AppRole,
): Promise<{ scope: Scope; scopeLabel: string } | null> {
  if (role === "MASTER_ADMIN") {
    return { scope: { kind: "GLOBAL" }, scopeLabel: "Seluruh organisasi" };
  }

  if (role === "REGIONAL_ADMIN") {
    if (!data.regionId || !data.regionName) return null;
    return {
      scope: {
        kind: "REGION",
        regionId: data.regionId,
        regionName: data.regionName,
        branchIds: stringIds(data.regionBranchIds),
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

type LoadedSession = Awaited<
  ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>
>;

/**
 * Session lookup is cached briefly to avoid two database round-trips on every
 * request. Role, scope, and account status are still read fresh below, so
 * deactivation and scope changes take effect immediately; revocation of a
 * stolen session cookie lags by at most the TTL.
 */
const SESSION_CACHE_TTL_MS = 30_000;
const SESSION_CACHE_MAX = 5_000;
const sessionCache = new Map<
  string,
  { expiresAt: number; value: Promise<LoadedSession> }
>();

function sessionTokenFrom(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const name = trimmed.slice(0, separator);
    if (name.includes("session_token")) return trimmed.slice(separator + 1);
  }
  return null;
}

async function getSession(requestHeaders: Headers): Promise<LoadedSession> {
  const token = sessionTokenFrom(requestHeaders.get("cookie"));
  if (!token) {
    return getAuth().api.getSession({ headers: requestHeaders });
  }
  const now = Date.now();
  const cached = sessionCache.get(token);
  if (cached && cached.expiresAt > now) return cached.value;
  const value = getAuth().api.getSession({ headers: requestHeaders });
  sessionCache.set(token, {
    expiresAt: now + SESSION_CACHE_TTL_MS,
    value,
  });
  if (sessionCache.size > SESSION_CACHE_MAX) {
    for (const [key, entry] of sessionCache) {
      if (entry.expiresAt <= now) sessionCache.delete(key);
    }
    if (sessionCache.size > SESSION_CACHE_MAX) {
      const oldest = sessionCache.keys().next().value;
      if (oldest) sessionCache.delete(oldest);
    }
  }
  try {
    return await value;
  } catch (error) {
    sessionCache.delete(token);
    throw error;
  }
}

async function loadAuthContext(): Promise<AuthContext | null> {
  const session = await getSession(await headers());
  if (!session?.user) return null;

  const db = getDb();
  const [row] = await db
    .select({
      membership: schema.userMemberships,
      profile: schema.userProfiles,
      scope: {
        regionId: scopeRegion.id,
        regionName: scopeRegion.name,
        // Satu kueri dengan membership: menghindari round-trip serial untuk
        // daftar cabang yang sebelumnya membuat rute wilayah lebih lambat.
        regionBranchIds: sql<string[]>`coalesce((
          select json_agg(region_branch.id order by region_branch.id)
          from ${schema.branchOffices} as region_branch
          where region_branch.regional_office_id = ${scopeRegion.id}
        ), '[]'::json)`,
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
    locationStatus: isLocationStatus(row.profile.locationStatus)
      ? row.profile.locationStatus
      : "PENDING",
    locationGraceDeadline: row.profile.locationGraceDeadline ?? null,
    displayTitle: row.profile.displayTitle,
    membershipId: row.membership.id,
    homePath: homePathForRole(role),
  };
}

export const getAuthContext = cache(loadAuthContext);

export function hasCapability(ctx: AuthContext, capability: string): boolean {
  return (ctx.capabilities as readonly string[]).includes(capability);
}
