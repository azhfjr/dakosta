import { NextResponse } from "next/server";

import { getDb, schema } from "@/db";
import { getAuth } from "@/lib/auth";
import { DEMO_ACCOUNTS, isDemoRole } from "@/lib/demo";
import { isDemoMode } from "@/lib/env";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignInPayload = { user?: { id?: string } } | null;

export async function POST(request: Request) {
  if (!isDemoMode) {
    return NextResponse.json(
      { error: { code: "DEMO_DISABLED", message: "Mode demo tidak aktif." } },
      { status: 404 },
    );
  }

  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password) {
    return NextResponse.json(
      {
        error: {
          code: "DEMO_NOT_SEEDED",
          message: "Akun demo belum disiapkan pada lingkungan ini.",
        },
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    role?: unknown;
  } | null;

  if (!body || !isDemoRole(body.role)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_ROLE",
          message: "Peran demo tidak dikenali.",
        },
      },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);
  const limit = await consumeRateLimit({
    key: `demo-login:${ip}`,
    limit: 10,
    windowSeconds: 60,
  });
  const rateHeaders = await getRateLimitHeaders(limit);

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Terlalu banyak percobaan. Coba lagi sebentar.",
        },
      },
      { status: 429, headers: rateHeaders },
    );
  }

  const account = DEMO_ACCOUNTS[body.role];
  const authResponse = await getAuth().api.signInEmail({
    body: { email: account.email, password },
    asResponse: true,
  });

  if (!authResponse.ok) {
    return NextResponse.json(
      {
        error: {
          code: "DEMO_LOGIN_FAILED",
          message: "Akun demo tidak dapat masuk. Jalankan seed ulang.",
        },
      },
      { status: 502, headers: rateHeaders },
    );
  }

  let userId: string | undefined;
  try {
    const payload = (await authResponse.clone().json()) as SignInPayload;
    userId = payload?.user?.id;
  } catch {
    userId = undefined;
  }

  await getDb()
    .insert(schema.auditLogs)
    .values({
      actorId: userId ?? null,
      actorRole: body.role === "admin" ? "ADMIN" : "CLIENT",
      action: "DEMO_LOGIN",
      recordType: "AUTH",
      recordId: userId ?? account.email,
      after: { role: body.role, mode: "quick_login" },
    })
    .catch(() => undefined);

  const response = NextResponse.json(
    {
      data: {
        role: body.role,
        redirectTo: account.redirectTo,
      },
    },
    { headers: rateHeaders },
  );

  for (const cookie of authResponse.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
