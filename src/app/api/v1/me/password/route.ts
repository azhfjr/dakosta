import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { getDb, schema } from "@/db";
import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/authz/guards";
import { getAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { guardRateLimit } from "@/lib/rate-limit";
import { getApiUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12, "Kata sandi minimal 12 karakter.").max(128),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const user = await getApiUser({ allowPasswordChangePending: true });
    await guardRateLimit(request, "mutation", "password-change");
    const body = bodySchema.parse(await readJson(request));

    if (body.currentPassword === body.newPassword) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Kata sandi baru harus berbeda dari kata sandi saat ini.",
        400,
      );
    }

    await getAuth().api.changePassword({
      body: {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });

    await getDb()
      .update(schema.userProfiles)
      .set({ mustChangePassword: false, updatedAt: new Date() })
      .where(eq(schema.userProfiles.userId, user.id));

    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "PASSWORD_CHANGED",
      recordType: "USER",
      recordId: user.id,
      requestId,
    });

    return jsonOk({ changed: true }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
