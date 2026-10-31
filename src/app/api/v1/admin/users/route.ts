import { randomBytes } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { getDb, schema } from "@/db";
import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { getAuth } from "@/lib/auth";
import { AppError, errors } from "@/lib/errors";
import { getApiUserWithRole } from "@/lib/session";
import { listAdminUsers, listStakeholderOptions } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_EMAIL_DOMAIN = "@demo.dakosta.local";

const createSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format email tidak valid.")
    .refine(
      (value) => value.endsWith(DEMO_EMAIL_DOMAIN),
      `Gunakan alamat demo berakhiran ${DEMO_EMAIL_DOMAIN}.`,
    ),
  displayTitle: z.string().trim().max(80).optional(),
  stakeholderIds: z
    .array(z.string().uuid())
    .min(1, "Pilih minimal satu stakeholder.")
    .max(10),
});

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await getApiUserWithRole("ADMIN");
    const [users, stakeholders] = await Promise.all([
      listAdminUsers(),
      listStakeholderOptions(),
    ]);
    return jsonOk({ users, stakeholders }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const admin = await getApiUserWithRole("ADMIN");
    const body = createSchema.parse(await readJson(request));

    const db = getDb();
    const uniqueStakeholderIds = [...new Set(body.stakeholderIds)];

    const validStakeholders = await db
      .select({ id: schema.stakeholders.id })
      .from(schema.stakeholders)
      .where(
        and(
          inArray(schema.stakeholders.id, uniqueStakeholderIds),
          eq(schema.stakeholders.status, "ACTIVE"),
        ),
      );

    if (validStakeholders.length !== uniqueStakeholderIds.length) {
      throw errors.validation("Ada stakeholder yang tidak aktif atau tidak ditemukan.");
    }

    const tempPassword = randomBytes(9).toString("base64url");

    let createdUserId: string | null = null;
    try {
      const created = await getAuth().api.createUser({
        body: {
          email: body.email,
          name: body.name,
          password: tempPassword,
          role: "user",
        },
        headers: await headers(),
      });
      createdUserId = created.user.id;

      await db.transaction(async (tx) => {
        await tx.insert(schema.userProfiles).values({
          userId: createdUserId!,
          mustChangePassword: true,
          isDemo: true,
          active: true,
          displayTitle: body.displayTitle || null,
        });

        await tx.insert(schema.userRoleMemberships).values({
          userId: createdUserId!,
          role: "CLIENT",
        });

        await tx.insert(schema.userStakeholderMemberships).values(
          uniqueStakeholderIds.map((stakeholderId) => ({
            userId: createdUserId!,
            stakeholderId,
          })),
        );
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

    await recordAudit({
      actorId: admin.id,
      actorRole: admin.role,
      action: "USER_CREATED",
      recordType: "USER",
      recordId: createdUserId,
      after: {
        email: body.email,
        role: "CLIENT",
        stakeholderIds: uniqueStakeholderIds,
      },
      requestId,
    });

    return jsonOk(
      {
        userId: createdUserId,
        email: body.email,
        tempPassword,
        mustChangePassword: true,
      },
      { requestId, status: 201 },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
