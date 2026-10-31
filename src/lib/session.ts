import "server-only";

import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/authz/context";
import { getApiAuth, requireAuth } from "@/lib/authz/guards";
import { homePathForRole, type AppRole, type Capability, type Scope } from "@/lib/authz/types";

export type { AppRole } from "@/lib/authz/types";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  scope: Scope;
  capabilities: readonly Capability[];
  membershipId: string;
  isDemo: boolean;
  mustChangePassword: boolean;
  active: boolean;
  displayTitle: string | null;
  homePath: string;
  scopeLabel: string;
  /** Legacy compatibility: organization IDs visible to stakeholder accounts. */
  stakeholderIds: string[];
};

export function toSessionUser(ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>): SessionUser {  return {
    id: ctx.userId,
    name: ctx.name,
    email: ctx.email,
    role: ctx.role,
    scope: ctx.scope,
    capabilities: ctx.capabilities,
    membershipId: ctx.membershipId,
    isDemo: ctx.isDemo,
    mustChangePassword: ctx.mustChangePassword,
    active: true,
    displayTitle: ctx.displayTitle,
    homePath: ctx.homePath,
    scopeLabel: ctx.scopeLabel,
    stakeholderIds: ctx.scope.kind === "ORG" ? [ctx.scope.organizationId] : [],
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const ctx = await getAuthContext();
  return ctx ? toSessionUser(ctx) : null;
}

export async function requireUser(
  options: { allowPasswordChangePending?: boolean } = {},
): Promise<SessionUser> {
  const ctx = await requireAuth(options);
  return toSessionUser(ctx);
}

function resolveLegacyRole(role: AppRole | "ADMIN" | "CLIENT"): AppRole {
  if (role === "ADMIN") return "MASTER_ADMIN";
  if (role === "CLIENT") return "STAKEHOLDER";
  return role;
}

export async function requireRole(
  role: AppRole | "ADMIN" | "CLIENT",
): Promise<SessionUser> {
  const user = await requireUser();
  const expected = resolveLegacyRole(role);
  if (user.role !== expected) {
    redirect("/akses-ditolak");
  }
  return user;
}

export async function getApiUser(
  options: { allowPasswordChangePending?: boolean } = {},
): Promise<SessionUser> {
  const ctx = await getApiAuth(options);
  return toSessionUser(ctx);
}

export async function getApiUserWithRole(
  role: AppRole | "ADMIN" | "CLIENT",
): Promise<SessionUser> {
  const user = await getApiUser();
  const expected = resolveLegacyRole(role);
  if (user.role !== expected) {
    const { errors } = await import("@/lib/errors");
    throw errors.forbidden();
  }
  return user;
}

export function isMaster(user: Pick<SessionUser, "role">): boolean {
  return user.role === "MASTER_ADMIN";
}

export function isStakeholder(user: Pick<SessionUser, "role">): boolean {
  return user.role === "STAKEHOLDER";
}

export function isReviewer(user: Pick<SessionUser, "role">): boolean {
  return user.role === "BRANCH_ADMIN" || user.role === "MASTER_ADMIN";
}

export function homePathFor(user: Pick<SessionUser, "role">): string {
  return homePathForRole(user.role);
}
