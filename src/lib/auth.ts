import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { getDb, schema } from "@/db";
import { getAppUrl, getAuthSecret } from "@/lib/env";

function collectTrustedOrigins(): string[] {
  const origins = new Set<string>([
    getAppUrl(),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);

  for (const candidate of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (!candidate) continue;
    origins.add(candidate.startsWith("http") ? candidate : `https://${candidate}`);
  }

  return [...origins];
}

function createAuth() {
  return betterAuth({
    appName: "DAKOSTA",
    baseURL: getAppUrl(),
    basePath: "/api/auth",
    secret: getAuthSecret(),
    trustedOrigins: collectTrustedOrigins(),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      // Public sign-up stays closed; accounts are provisioned by an admin.
      disableSignUp: true,
      autoSignIn: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 8 },
        "/change-password": { window: 60, max: 6 },
      },
    },
    plugins: [
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
      }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;

let auth: Auth | undefined;

export function getAuth(): Auth {
  if (!auth) auth = createAuth();
  return auth;
}
