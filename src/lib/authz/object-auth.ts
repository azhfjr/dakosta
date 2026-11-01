import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { errors } from "@/lib/errors";

import { contentScopePredicate, isOrganizationInScope } from "./predicates";
import type { AuthContext } from "./types";

export type ScopedContent = {
  id: string;
  stakeholderId: string;
  branchOfficeId: string | null;
  regionId: string | null;
  status: string;
  version: number;
  createdBy: string;
  title: string | null;
  referenceCode: string;
};

export async function findContentInScope(
  ctx: AuthContext,
  submissionId: string,
): Promise<ScopedContent> {
  const scopePredicate = contentScopePredicate(
    ctx,
    schema.contentSubmissions.stakeholderId,
  );

  const [row] = await getDb()
    .select({
      id: schema.contentSubmissions.id,
      stakeholderId: schema.contentSubmissions.stakeholderId,
      branchOfficeId: schema.stakeholders.branchOfficeId,
      regionId: schema.branchOffices.regionalOfficeId,
      status: schema.contentSubmissions.status,
      version: schema.contentSubmissions.version,
      createdBy: schema.contentSubmissions.createdBy,
      title: schema.contentSubmissions.title,
      referenceCode: schema.contentSubmissions.referenceCode,
    })
    .from(schema.contentSubmissions)
    .innerJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.contentSubmissions.stakeholderId),
    )
    .leftJoin(
      schema.branchOffices,
      eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
    )
    .where(
      and(
        eq(schema.contentSubmissions.id, submissionId),
        scopePredicate ?? undefined,
      ),
    )
    .limit(1);

  if (!row) throw errors.notFound("Konten tidak ditemukan.");
  return row;
}

export async function requireContentInScope(
  ctx: AuthContext,
  submissionId: string,
): Promise<ScopedContent> {
  return findContentInScope(ctx, submissionId);
}

export async function requireOrganizationInScope(
  ctx: AuthContext,
  organizationId: string,
): Promise<{ id: string; name: string; branchOfficeId: string | null }> {
  const [row] = await getDb()
    .select({
      id: schema.stakeholders.id,
      name: schema.stakeholders.name,
      branchOfficeId: schema.stakeholders.branchOfficeId,
    })
    .from(schema.stakeholders)
    .where(eq(schema.stakeholders.id, organizationId))
    .limit(1);

  if (!row || !isOrganizationInScope(ctx.scope, row)) {
    throw errors.notFound("Organisasi tidak ditemukan.");
  }
  return row;
}

export async function requireBranchInScope(
  ctx: AuthContext,
  branchId: string,
): Promise<{ id: string; name: string; regionalOfficeId: string }> {
  const [row] = await getDb()
    .select({
      id: schema.branchOffices.id,
      name: schema.branchOffices.name,
      regionalOfficeId: schema.branchOffices.regionalOfficeId,
    })
    .from(schema.branchOffices)
    .where(eq(schema.branchOffices.id, branchId))
    .limit(1);

  if (!row) throw errors.notFound("Cabang tidak ditemukan.");

  if (ctx.scope.kind === "GLOBAL") return row;
  if (
    ctx.scope.kind === "REGION" &&
    ctx.scope.regionId === row.regionalOfficeId
  ) {
    return row;
  }
  if (ctx.scope.kind === "BRANCH" && ctx.scope.branchId === row.id) return row;
  if (ctx.scope.kind === "ORG" && ctx.scope.branchId === row.id) return row;

  throw errors.notFound("Cabang tidak ditemukan.");
}

export async function requireRegionInScope(
  ctx: AuthContext,
  regionId: string,
): Promise<{ id: string; name: string }> {
  const [row] = await getDb()
    .select({
      id: schema.regionalOffices.id,
      name: schema.regionalOffices.name,
    })
    .from(schema.regionalOffices)
    .where(eq(schema.regionalOffices.id, regionId))
    .limit(1);

  if (!row) throw errors.notFound("Wilayah tidak ditemukan.");
  if (ctx.scope.kind === "GLOBAL") return row;
  if (
    (ctx.scope.kind === "REGION" || ctx.scope.kind === "BRANCH") &&
    ctx.scope.regionId === row.id
  ) {
    return row;
  }
  if (ctx.scope.kind === "ORG" && ctx.scope.regionId === row.id) return row;
  throw errors.notFound("Wilayah tidak ditemukan.");
}

export async function requireAccountInScope(
  ctx: AuthContext,
  targetUserId: string,
): Promise<{ userId: string; role: string; organizationId: string | null }> {
  const [row] = await getDb()
    .select({
      userId: schema.userMemberships.userId,
      role: schema.userMemberships.role,
      organizationId: schema.userMemberships.organizationId,
    })
    .from(schema.userMemberships)
    .where(
      and(
        eq(schema.userMemberships.userId, targetUserId),
        isNull(schema.userMemberships.revokedAt),
      ),
    )
    .limit(1);

  if (!row) throw errors.notFound("Akun tidak ditemukan.");
  if (ctx.scope.kind === "GLOBAL") return row;
  if (
    ctx.scope.kind === "ORG" &&
    row.organizationId === ctx.scope.organizationId
  ) {
    return row;
  }
  throw errors.notFound("Akun tidak ditemukan.");
}
