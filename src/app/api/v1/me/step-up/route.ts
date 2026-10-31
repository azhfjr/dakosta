import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestId, jsonError, jsonOk, readJson } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { getAuth } from "@/lib/auth";
import { assertSameOrigin, getApiAuth } from "@/lib/authz/guards";
import { markStepUp } from "@/lib/authz/step-up";
import { errors } from "@/lib/errors";
import { consumeRateLimit, getClientIp, getRateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  password: z.string().min(1, "Kata sandi wajib diisi.").max(200),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const ctx = await getApiAuth();
    const limit = await consumeRateLimit({
      key: `stepup:${ctx.userId}:${getClientIp(request)}`,
      limit: 5,
      windowSeconds: 60,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Terlalu banyak percobaan konfirmasi. Coba lagi sebentar.",
          },
          meta: { requestId },
        },
        { status: 429, headers: await getRateLimitHeaders(limit) },
      );
    }

    const body = schema.parse(await readJson(request));
    const verified = await getAuth().api.verifyPassword({
      body: { password: body.password },
      headers: await headers(),
    });
    if (!verified.status) {
      await recordAudit({
        actorId: ctx.userId,
        actorRole: ctx.role,
        action: "STEP_UP_DENIED",
        recordType: "USER",
        recordId: ctx.userId,
        after: { reason: "password_mismatch" },
        requestId,
        source: "API",
      });
      throw errors.validation("Kata sandi tidak cocok.");
    }

    await markStepUp(ctx.userId);
    await recordAudit({
      actorId: ctx.userId,
      actorRole: ctx.role,
      action: "STEP_UP_GRANTED",
      recordType: "USER",
      recordId: ctx.userId,
      after: { windowMinutes: 15 },
      requestId,
      source: "API",
    });

    return jsonOk({ confirmed: true }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
