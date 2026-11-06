import "server-only";

import { randomBytes } from "node:crypto";

import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { getDb, schema } from "@/db";
import { issueInvitation } from "@/lib/accounts/invitations";
import { getAuth } from "@/lib/auth";
import { assertDemoCannotManageAccounts } from "@/lib/authz/demo-guard";
import type { AppRole } from "@/lib/authz/types";
import { ROLE_LABELS } from "@/lib/authz/types";
import { AppError, errors } from "@/lib/errors";

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  roleLabel: string;
  status: string;
  active: boolean;
  mustChangePassword: boolean;
  isDemo: boolean;
  displayTitle: string | null;
  createdAt: string;
  membershipId: string;
  regionalOfficeId: string | null;
  branchOfficeId: string | null;
  organizationId: string | null;
  scopeLabel: string;
};

export type ScopeOptions = {
  regions: Array<{ id: string; name: string; code: string }>;
  branches: Array<{
    id: string;
    name: string;
    code: string;
    regionalOfficeId: string;
    regionName: string;
  }>;
  organizations: Array<{
    id: string;
    name: string;
    organizationType: string;
    faskesClass: string | null;
    branchOfficeId: string | null;
    branchName: string | null;
  }>;
};

export async function listAccounts(): Promise<AccountRow[]> {
  const rows = await getDb()
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      createdAt: schema.user.createdAt,
      role: schema.userMemberships.role,
      membershipId: schema.userMemberships.id,
      regionalOfficeId: schema.userMemberships.regionalOfficeId,
      branchOfficeId: schema.userMemberships.branchOfficeId,
      organizationId: schema.userMemberships.organizationId,
      status: schema.userProfiles.status,
      active: schema.userProfiles.active,
      mustChangePassword: schema.userProfiles.mustChangePassword,
      isDemo: schema.userProfiles.isDemo,
      displayTitle: schema.userProfiles.displayTitle,
      regionName: schema.regionalOffices.name,
      branchName: schema.branchOffices.name,
      organizationName: schema.stakeholders.name,
    })
    .from(schema.user)
    .innerJoin(
      schema.userMemberships,
      and(
        eq(schema.userMemberships.userId, schema.user.id),
        isNull(schema.userMemberships.revokedAt),
      ),
    )
    .innerJoin(
      schema.userProfiles,
      eq(schema.userProfiles.userId, schema.user.id),
    )
    .leftJoin(
      schema.regionalOffices,
      eq(schema.regionalOffices.id, schema.userMemberships.regionalOfficeId),
    )
    .leftJoin(
      schema.branchOffices,
      eq(schema.branchOffices.id, schema.userMemberships.branchOfficeId),
    )
    .leftJoin(
      schema.stakeholders,
      eq(schema.stakeholders.id, schema.userMemberships.organizationId),
    )
    .orderBy(asc(schema.user.name));

  return rows.map((row) => {
    const role = row.role as AppRole;
    const scopeLabel =
      role === "MASTER_ADMIN"
        ? "Seluruh organisasi"
        : role === "REGIONAL_ADMIN"
          ? (row.regionName ?? "Wilayah tidak ditemukan")
          : role === "BRANCH_ADMIN"
            ? (row.branchName ?? "Cabang tidak ditemukan")
            : (row.organizationName ?? "Organisasi tidak ditemukan");
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role,
      roleLabel: ROLE_LABELS[role] ?? role,
      status: row.status,
      active: row.active,
      mustChangePassword: row.mustChangePassword,
      isDemo: row.isDemo,
      displayTitle: row.displayTitle,
      createdAt: row.createdAt.toISOString(),
      membershipId: row.membershipId,
      regionalOfficeId: row.regionalOfficeId,
      branchOfficeId: row.branchOfficeId,
      organizationId: row.organizationId,
      scopeLabel,
    };
  });
}

export async function listScopeOptions(): Promise<ScopeOptions> {
  const db = getDb();
  const [regions, branches, organizations] = await Promise.all([
    db
      .select({
        id: schema.regionalOffices.id,
        name: schema.regionalOffices.name,
        code: schema.regionalOffices.code,
      })
      .from(schema.regionalOffices)
      .where(eq(schema.regionalOffices.status, "ACTIVE"))
      .orderBy(asc(schema.regionalOffices.name)),
    db
      .select({
        id: schema.branchOffices.id,
        name: schema.branchOffices.name,
        code: schema.branchOffices.code,
        regionalOfficeId: schema.branchOffices.regionalOfficeId,
        regionName: schema.regionalOffices.name,
      })
      .from(schema.branchOffices)
      .innerJoin(
        schema.regionalOffices,
        eq(schema.regionalOffices.id, schema.branchOffices.regionalOfficeId),
      )
      .where(eq(schema.branchOffices.status, "ACTIVE"))
      .orderBy(asc(schema.branchOffices.name)),
    db
      .select({
        id: schema.stakeholders.id,
        name: schema.stakeholders.name,
        organizationType: schema.stakeholders.organizationType,
        faskesClass: schema.stakeholders.faskesClass,
        branchOfficeId: schema.stakeholders.branchOfficeId,
        branchName: schema.branchOffices.name,
      })
      .from(schema.stakeholders)
      .leftJoin(
        schema.branchOffices,
        eq(schema.branchOffices.id, schema.stakeholders.branchOfficeId),
      )
      .where(eq(schema.stakeholders.status, "ACTIVE"))
      .orderBy(asc(schema.stakeholders.name)),
  ]);
  return { regions, branches, organizations };
}

const accountInputSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80),
  email: z.string().trim().toLowerCase().email("Format email tidak valid."),
  displayTitle: z.string().trim().max(80).optional(),
  role: z.enum([
    "MASTER_ADMIN",
    "REGIONAL_ADMIN",
    "BRANCH_ADMIN",
    "STAKEHOLDER",
  ]),
  regionalOfficeId: z.string().uuid().nullish(),
  branchOfficeId: z.string().uuid().nullish(),
  organizationId: z.string().uuid().nullish(),
});

export type CreateAccountInput = z.infer<typeof accountInputSchema>;

export const createAccountInputSchema = accountInputSchema;

function generateInitialPassword(): string {
  // Never shown or returned; the account is activated through a one-time link.
  return randomBytes(32).toString("base64url");
}

async function assertScopeCombination(input: {
  role: AppRole;
  regionalOfficeId?: string | null;
  branchOfficeId?: string | null;
  organizationId?: string | null;
}): Promise<void> {
  const db = getDb();
  if (input.role === "MASTER_ADMIN") {
    if (
      input.regionalOfficeId ||
      input.branchOfficeId ||
      input.organizationId
    ) {
      throw errors.validation(
        "Master Admin tidak boleh memiliki lingkup wilayah/cabang/organisasi.",
      );
    }
    return;
  }
  if (input.role === "REGIONAL_ADMIN") {
    if (
      !input.regionalOfficeId ||
      input.branchOfficeId ||
      input.organizationId
    ) {
      throw errors.validation(
        "Admin wilayah wajib terikat pada satu wilayah saja.",
      );
    }
    const [region] = await db
      .select({ id: schema.regionalOffices.id })
      .from(schema.regionalOffices)
      .where(
        and(
          eq(schema.regionalOffices.id, input.regionalOfficeId),
          eq(schema.regionalOffices.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (!region)
      throw errors.validation("Wilayah tidak ditemukan atau tidak aktif.");
    return;
  }
  if (input.role === "BRANCH_ADMIN") {
    if (!input.branchOfficeId || input.organizationId) {
      throw errors.validation("Admin cabang wajib terikat pada satu cabang.");
    }
    if (input.regionalOfficeId) {
      const [branch] = await db
        .select({ regionId: schema.branchOffices.regionalOfficeId })
        .from(schema.branchOffices)
        .where(eq(schema.branchOffices.id, input.branchOfficeId))
        .limit(1);
      if (!branch || branch.regionId !== input.regionalOfficeId) {
        throw errors.validation(
          "Cabang tidak berada pada wilayah yang dipilih.",
        );
      }
    }
    const [branch] = await db
      .select({ id: schema.branchOffices.id })
      .from(schema.branchOffices)
      .where(
        and(
          eq(schema.branchOffices.id, input.branchOfficeId),
          eq(schema.branchOffices.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (!branch)
      throw errors.validation("Cabang tidak ditemukan atau tidak aktif.");
    return;
  }
  if (!input.organizationId) {
    throw errors.validation(
      "Akun stakeholder wajib terikat pada satu organisasi.",
    );
  }
  const [organization] = await db
    .select({ id: schema.stakeholders.id })
    .from(schema.stakeholders)
    .where(
      and(
        eq(schema.stakeholders.id, input.organizationId),
        eq(schema.stakeholders.status, "ACTIVE"),
      ),
    )
    .limit(1);
  if (!organization)
    throw errors.validation("Organisasi tidak ditemukan atau tidak aktif.");
}

async function countActiveMasters(excludeUserId?: string): Promise<number> {
  const conditions = [
    eq(schema.userMemberships.role, "MASTER_ADMIN"),
    isNull(schema.userMemberships.revokedAt),
    eq(schema.userProfiles.status, "ACTIVE"),
  ];
  if (excludeUserId) {
    conditions.push(ne(schema.userMemberships.userId, excludeUserId));
  }
  const [row] = await getDb()
    .select({ total: sql<number>`count(*)` })
    .from(schema.userMemberships)
    .innerJoin(
      schema.userProfiles,
      eq(schema.userProfiles.userId, schema.userMemberships.userId),
    )
    .where(and(...conditions));
  return Number(row?.total ?? 0);
}

export async function createAccount(
  input: CreateAccountInput,
  options: { createdBy?: string | null } = {},
): Promise<{
  userId: string;
  email: string;
  activationUrl: string;
  activationExpiresAt: string;
}> {
  await assertDemoCannotManageAccounts();
  const parsed = accountInputSchema.parse(input);
  await assertScopeCombination(parsed);

  const db = getDb();
  const initialPassword = generateInitialPassword();
  const displayTitle = parsed.displayTitle?.trim() || ROLE_LABELS[parsed.role];

  let createdUserId: string | null = null;
  try {
    const created = await getAuth().api.createUser({
      body: {
        email: parsed.email,
        name: parsed.name,
        password: initialPassword,
        role: parsed.role === "MASTER_ADMIN" ? "admin" : "user",
      },
      headers: await headers(),
    });
    createdUserId = created.user.id;

    await db.transaction(async (tx) => {
      await tx.insert(schema.userProfiles).values({
        userId: createdUserId!,
        mustChangePassword: true,
        isDemo: false,
        active: true,
        status: "ACTIVE",
        displayTitle,
      });

      await tx.insert(schema.userRoleMemberships).values({
        userId: createdUserId!,
        role: parsed.role === "MASTER_ADMIN" ? "ADMIN" : "CLIENT",
      });

      await tx.insert(schema.userMemberships).values({
        userId: createdUserId!,
        role: parsed.role,
        regionalOfficeId: parsed.regionalOfficeId ?? null,
        branchOfficeId: parsed.branchOfficeId ?? null,
        organizationId: parsed.organizationId ?? null,
      });

      if (parsed.organizationId) {
        await tx.insert(schema.userStakeholderMemberships).values({
          userId: createdUserId!,
          stakeholderId: parsed.organizationId,
        });
      }
    });
  } catch (error) {
    if (createdUserId) {
      await getAuth()
        .api.removeUser({
          body: { userId: createdUserId },
          headers: await headers(),
        })
        .catch(() => undefined);
    }
    if (error instanceof AppError) throw error;
    throw new AppError(
      "USER_CREATE_FAILED",
      "Akun tidak dapat dibuat. Periksa apakah email sudah terdaftar.",
      409,
    );
  }

  const invitation = await issueInvitation({
    userId: createdUserId!,
    purpose: "ACTIVATION",
    createdBy: options.createdBy ?? null,
  });

  return {
    userId: createdUserId!,
    email: parsed.email,
    activationUrl: invitation.url,
    activationExpiresAt: invitation.expiresAt,
  };
}

const patchSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    displayTitle: z.string().trim().max(80).nullish(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
    role: z
      .enum(["MASTER_ADMIN", "REGIONAL_ADMIN", "BRANCH_ADMIN", "STAKEHOLDER"])
      .optional(),
    regionalOfficeId: z.string().uuid().nullish(),
    branchOfficeId: z.string().uuid().nullish(),
    organizationId: z.string().uuid().nullish(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Tidak ada perubahan yang dikirim.",
  });

export type UpdateAccountInput = z.infer<typeof patchSchema>;
export const updateAccountInputSchema = patchSchema;

export async function updateAccount(
  actorId: string,
  userId: string,
  input: UpdateAccountInput,
): Promise<void> {
  await assertDemoCannotManageAccounts();
  const patch = patchSchema.parse(input);
  const db = getDb();

  const [current] = await db
    .select({
      role: schema.userMemberships.role,
      membershipId: schema.userMemberships.id,
      regionalOfficeId: schema.userMemberships.regionalOfficeId,
      branchOfficeId: schema.userMemberships.branchOfficeId,
      organizationId: schema.userMemberships.organizationId,
      status: schema.userProfiles.status,
    })
    .from(schema.userMemberships)
    .innerJoin(
      schema.userProfiles,
      eq(schema.userProfiles.userId, schema.userMemberships.userId),
    )
    .where(
      and(
        eq(schema.userMemberships.userId, userId),
        isNull(schema.userMemberships.revokedAt),
      ),
    )
    .limit(1);

  if (!current) throw errors.notFound("Akun tidak ditemukan.");

  const nextRole = (patch.role ?? current.role) as AppRole;
  const scopeChanged =
    nextRole !== current.role ||
    (patch.regionalOfficeId !== undefined &&
      (patch.regionalOfficeId ?? null) !== current.regionalOfficeId) ||
    (patch.branchOfficeId !== undefined &&
      (patch.branchOfficeId ?? null) !== current.branchOfficeId) ||
    (patch.organizationId !== undefined &&
      (patch.organizationId ?? null) !== current.organizationId);

  const nextScope = scopeChanged
    ? {
        regionalOfficeId:
          patch.regionalOfficeId !== undefined
            ? (patch.regionalOfficeId ?? null)
            : current.regionalOfficeId,
        branchOfficeId:
          patch.branchOfficeId !== undefined
            ? (patch.branchOfficeId ?? null)
            : current.branchOfficeId,
        organizationId:
          patch.organizationId !== undefined
            ? (patch.organizationId ?? null)
            : current.organizationId,
      }
    : {
        regionalOfficeId: current.regionalOfficeId,
        branchOfficeId: current.branchOfficeId,
        organizationId: current.organizationId,
      };

  if (scopeChanged) {
    await assertScopeCombination({ role: nextRole, ...nextScope });
  }

  const losingMaster =
    current.role === "MASTER_ADMIN" &&
    (nextRole !== "MASTER_ADMIN" ||
      patch.status === "SUSPENDED" ||
      patch.status === "DISABLED");
  if (losingMaster && (await countActiveMasters(userId)) === 0) {
    throw errors.conflict(
      "Master Admin aktif terakhir tidak dapat diturunkan atau dinonaktifkan.",
    );
  }
  if (patch.status && patch.status !== "ACTIVE" && userId === actorId) {
    throw errors.validation("Anda tidak dapat menonaktifkan akun sendiri.");
  }

  await db.transaction(async (tx) => {
    if (patch.name !== undefined) {
      await tx
        .update(schema.user)
        .set({ name: patch.name, updatedAt: new Date() })
        .where(eq(schema.user.id, userId));
    }

    if (patch.status !== undefined || patch.displayTitle !== undefined) {
      await tx
        .update(schema.userProfiles)
        .set({
          ...(patch.status
            ? { status: patch.status, active: patch.status === "ACTIVE" }
            : {}),
          ...(patch.displayTitle !== undefined
            ? { displayTitle: patch.displayTitle ?? null }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.userProfiles.userId, userId));
      await tx
        .update(schema.user)
        .set({
          banned: patch.status === "DISABLED" || patch.status === "SUSPENDED",
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, userId));
    }

    if (scopeChanged) {
      await tx
        .update(schema.userMemberships)
        .set({ revokedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(schema.userMemberships.userId, userId),
            isNull(schema.userMemberships.revokedAt),
          ),
        );
      await tx.insert(schema.userMemberships).values({
        userId,
        role: nextRole,
        regionalOfficeId: nextScope.regionalOfficeId,
        branchOfficeId: nextScope.branchOfficeId,
        organizationId: nextScope.organizationId,
        createdBy: actorId,
      });
      await tx
        .update(schema.userRoleMemberships)
        .set({ role: nextRole === "MASTER_ADMIN" ? "ADMIN" : "CLIENT" })
        .where(eq(schema.userRoleMemberships.userId, userId));
      await tx
        .delete(schema.userStakeholderMemberships)
        .where(eq(schema.userStakeholderMemberships.userId, userId));
      if (nextScope.organizationId) {
        await tx.insert(schema.userStakeholderMemberships).values({
          userId,
          stakeholderId: nextScope.organizationId,
        });
      }
    }
  });

  if (scopeChanged || patch.status !== undefined) {
    await revokeUserSessions(userId);
  }
}

export async function revokeUserSessions(userId: string): Promise<number> {
  await assertDemoCannotManageAccounts();
  const result = await getDb()
    .delete(schema.session)
    .where(eq(schema.session.userId, userId))
    .returning({ id: schema.session.id });
  return result.length;
}

export async function resetAccountPassword(
  userId: string,
  actorId: string | null = null,
): Promise<{
  activationUrl: string;
  activationExpiresAt: string;
  mustChangePassword: boolean;
}> {
  await assertDemoCannotManageAccounts();

  await getDb()
    .update(schema.userProfiles)
    .set({ mustChangePassword: true, updatedAt: new Date() })
    .where(eq(schema.userProfiles.userId, userId));

  await revokeUserSessions(userId);

  const invitation = await issueInvitation({
    userId,
    purpose: "RESET",
    createdBy: actorId,
  });

  return {
    activationUrl: invitation.url,
    activationExpiresAt: invitation.expiresAt,
    mustChangePassword: true,
  };
}

export async function findAccount(userId: string): Promise<AccountRow | null> {
  const rows = await listAccounts();
  return rows.find((row) => row.id === userId) ?? null;
}
