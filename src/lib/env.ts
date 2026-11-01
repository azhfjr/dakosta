import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().optional(),
);

const optionalSecret = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().min(32).optional(),
);

const envSchema = z.object({
  APP_ENV: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.enum(["development", "staging", "production"]).optional(),
  ),
  DATABASE_URL: optionalString,
  BETTER_AUTH_SECRET: optionalSecret,
  BETTER_AUTH_URL: optionalString,
  NEXT_PUBLIC_APP_URL: optionalString,
  NEXT_PUBLIC_MAP_STYLE_URL: optionalString,
  DEMO_MODE: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.enum(["true", "false"]).optional(),
  ),
  DEMO_SEED_PASSWORD: optionalString,
  CRON_SECRET: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().min(16).optional(),
  ),
});

const parsed = envSchema.safeParse(process.env);

export const env = parsed.success ? parsed.data : {};

export type AppEnv = "development" | "staging" | "production";

export const appEnv: AppEnv =
  env.APP_ENV ??
  (process.env.VERCEL_ENV === "production"
    ? "production"
    : process.env.VERCEL_ENV === "preview"
      ? "staging"
      : "development");

export const isProductionRuntime = appEnv === "production";

export const isDemoMode = !isProductionRuntime && env.DEMO_MODE === "true";

export function getAppUrl(): string {
  return (
    env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

export function requireDatabaseUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }
  return env.DATABASE_URL;
}

export function getAuthSecret(): string {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV !== "production") {
    return "dakosta-development-only-secret-not-for-production-use";
  }
  throw new Error("BETTER_AUTH_SECRET wajib diatur di production.");
}
