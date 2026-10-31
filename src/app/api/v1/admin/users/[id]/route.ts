import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/db";
import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { AppError, errors } from "@/lib/errors";
import { isDemoMode } from "@/lib/env";
import { getApiUserWithRole } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    active: z.boolean().optional(),
    stakeholderIds: z.array(z.string().uuid()).min(1).max(10).optional(),
  })
  .refine((value) => value.active !== undefined || value.stakeholderIds !== undefined, {
    message: "Tidak ada perubahan yang dikirim.",
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  try {
    const admin = await getApiUserWithRole("ADMIN");
    const { id } = await context.params;
    const body = patchSchema.parse(await readJson(request));

    const db = getDb();
    const [target] = await db
      .select({
        userId: schema.userProfiles.userId,
        active: schema.userProfiles.active,
        isDemo: schema.userProfiles.isDemo,
      })
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, id))
      .limit(1);

    if (!target) throw errors.notFound("Pengguna tidak ditemukan.");

    if (body.active === false) {
      if (id === admin.id) {
        throw errors.validation("Anda tidak dapat menonaktifkan akun sendiri.");
      }
      if (isDemoMode && target.isDemo) {
        throw errors.forbidden("Akun DEMO tidak dapat dinonaktifkan saat mode demo aktif.");
      }
    }

    const roleRows = await db
      .select({ role: schema.userRoleMemberships.role })
      .from(schema.userRoleMemberships)
      .where(eq(schema.userRoleMemberships.userId, id));
    const isAdminTarget = roleRows.some((row) => row.role === "ADMIN");

    if (body.stakeholderIds) {
      if (isAdminTarget) {
        throw errors.validation("Admin tidak memiliki keterkaitan stakeholder.");
      }
      const uniqueIds = [...new Set(body.stakeholderIds)];
      const valid = await db
        .select({ id: schema.stakeholders.id })
        .from(schema.stakeholders)
        .where(
          and(
            inArray(schema.stakeholders.id, uniqueIds),
            eq(schema.stakeholders.status, "ACTIVE"),
          ),
        );
      if (valid.length !== uniqueIds.length) {
        throw errors.validation("Ada stakeholder yang tidak aktif atau tidak ditemukan.");
      }
    }

    await db.transaction(async (tx) => {
      if (body.active !== undefined) {
        await tx
          .update(schema.userProfiles)
          .set({ active: body.active, updatedAt: new Date() })
          .where(eq(schema.userProfiles.userId, id));
      }

      if (body.stakeholderIds) {
        const uniqueIds = [...new Set(body.stakeholderIds)];
        await tx
          .delete(schema.userStakeholderMemberships)
          .where(eq(schema.userStakeholderMemberships.userId, id));
        await tx.insert(schema.userStakeholderMemberships).values(
          uniqueIds.map((stakeholderId) => ({ userId: id, stakeholderId })),
        );
      }
    });

    await recordAudit({
      actorId: admin.id,
      actorRole: admin.role,
      action: "USER_UPDATED",
      recordType: "USER",
      recordId: id,
      before: { active: target.active },
      after: {
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.stakeholderIds ? { stakeholderIds: body.stakeholderIds } : {}),
      },
      requestId,
    });

    return jsonOk(
      {
        id,
        active: body.active ?? target.active,
        stakeholderIds: body.stakeholderIds ?? null,
      },
      { requestId },
    );
  } catch (error) {
    if (error instanceof AppError) return jsonError(error, requestId);
    return jsonError(error, requestId);
  }
}
