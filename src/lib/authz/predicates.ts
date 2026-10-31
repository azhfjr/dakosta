import "server-only";

import { eq, inArray, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { getDb, schema } from "@/db";
import type { AuthContext, Scope } from "./types";

type Column = AnyPgColumn;

/**
 * Content is scoped through its organization because scope always derives from
 * the organization's branch, never from client-supplied identifiers.
 */
export function contentScopePredicate(
  ctx: Pick<AuthContext, "scope">,
  organizationIdColumn: Column,
): SQL | undefined {
  return scopeForOrganizationColumn(ctx.scope, organizationIdColumn);
}

export function scopeForOrganizationColumn(
  scope: Scope,
  organizationIdColumn: Column,
): SQL | undefined {
  if (scope.kind === "GLOBAL") return undefined;
  if (scope.kind === "ORG") {
    return eq(organizationIdColumn, scope.organizationId);
  }
  if (scope.kind === "BRANCH") {
    return inArray(
      organizationIdColumn,
      getDb()
        .select({ id: schema.stakeholders.id })
        .from(schema.stakeholders)
        .where(eq(schema.stakeholders.branchOfficeId, scope.branchId)),
    );
  }
  // REGION: an empty branch list must never degrade to "all".
  if (scope.branchIds.length === 0) return sql`false`;
  return inArray(
    organizationIdColumn,
    getDb()
      .select({ id: schema.stakeholders.id })
      .from(schema.stakeholders)
      .where(inArray(schema.stakeholders.branchOfficeId, [...scope.branchIds])),
  );
}

/**
 * Organization registry scope. Callers pass the columns used by their query so
 * the predicate survives table aliasing.
 */
export function organizationScopePredicate(
  scope: Scope,
  columns: { id: Column; branchId: Column },
): SQL | undefined {
  if (scope.kind === "GLOBAL") return undefined;
  if (scope.kind === "ORG") return eq(columns.id, scope.organizationId);
  if (scope.kind === "BRANCH") return eq(columns.branchId, scope.branchId);
  if (scope.branchIds.length === 0) return sql`false`;
  return inArray(columns.branchId, [...scope.branchIds]);
}

export function branchScopePredicate(
  scope: Scope,
  branchColumn: Column,
): SQL | undefined {
  if (scope.kind === "GLOBAL") return undefined;
  if (scope.kind === "BRANCH") return eq(branchColumn, scope.branchId);
  if (scope.kind === "REGION") {
    if (scope.branchIds.length === 0) return sql`false`;
    return inArray(branchColumn, [...scope.branchIds]);
  }
  // ORG: restrict to the organization's branch when known, else its own rows.
  return scope.branchId
    ? eq(branchColumn, scope.branchId)
    : sql`false`;
}

export function regionScopePredicate(
  scope: Scope,
  regionColumn: Column,
): SQL | undefined {
  if (scope.kind === "GLOBAL") return undefined;
  if (scope.kind === "REGION") return eq(regionColumn, scope.regionId);
  if (scope.kind === "BRANCH") return eq(regionColumn, scope.regionId);
  if (scope.kind === "ORG") {
    return scope.regionId ? eq(regionColumn, scope.regionId) : sql`false`;
  }
  return sql`false`;
}

export function auditScopePredicate(
  scope: Scope,
  columns: { regionId: Column; branchId: Column; organizationId: Column },
): SQL | undefined {
  if (scope.kind === "GLOBAL") return undefined;
  if (scope.kind === "REGION") return eq(columns.regionId, scope.regionId);
  if (scope.kind === "BRANCH") return eq(columns.branchId, scope.branchId);
  return eq(columns.organizationId, scope.organizationId);
}

export function scopeOrganizationIds(scope: Scope): readonly string[] | null {
  return scope.kind === "ORG" ? [scope.organizationId] : null;
}

export function isOrganizationInScope(
  scope: Scope,
  organization: { id: string; branchOfficeId: string | null },
): boolean {
  switch (scope.kind) {
    case "GLOBAL":
      return true;
    case "ORG":
      return organization.id === scope.organizationId;
    case "BRANCH":
      return organization.branchOfficeId === scope.branchId;
    case "REGION":
      return (
        organization.branchOfficeId !== null &&
        scope.branchIds.includes(organization.branchOfficeId)
      );
  }
}
