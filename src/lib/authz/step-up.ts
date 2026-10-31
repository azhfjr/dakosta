import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { getAuthSecret, isProductionRuntime } from "@/lib/env";

const COOKIE_NAME = "dakosta_stepup";
const WINDOW_MS = 15 * 60 * 1000;

function sign(userId: string, issuedAt: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(`${userId}.${issuedAt}`)
    .digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function markStepUp(userId: string): Promise<void> {
  const issuedAt = String(Date.now());
  const store = await cookies();
  store.set(COOKIE_NAME, `${issuedAt}.${sign(userId, issuedAt)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProductionRuntime,
    path: "/",
    maxAge: Math.floor(WINDOW_MS / 1000),
  });
}

export async function hasRecentStepUp(userId: string): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const [issuedAt, signature] = raw.split(".");
  if (!issuedAt || !signature) return false;
  if (!safeEqual(signature, sign(userId, issuedAt))) return false;
  const age = Date.now() - Number(issuedAt);
  return Number.isFinite(age) && age >= 0 && age <= WINDOW_MS;
}

export async function clearStepUp(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export { WINDOW_MS as STEP_UP_WINDOW_MS };
